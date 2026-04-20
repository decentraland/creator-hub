import { randomUUID } from 'node:crypto';

import { WebSocketServer, WebSocket } from 'ws';
import type { WebContents } from 'electron';
import log from 'electron-log/main';
import type { MobileDebugSessionInfo } from '/shared/types/ipc';
import { getAvailablePort } from './port';
import { getLanIp } from './network';

export interface MobileDebugSession {
  id: number;
  ws: WebSocket | null;
  sessionId: string | null;
  deviceName: string | null;
  connectedAt: Date;
  disconnectedAt: Date | null;
  status: 'active' | 'ended';
  messageCount: number;
}

export interface BroadcastResult {
  ok: boolean;
  results: { sessionId: number; ok: boolean; data: unknown }[];
}

export type MobileDebugListener = (session: MobileDebugSession, entries: unknown[]) => void;

const SESSION_RETENTION_MS = 60_000;
const COMMAND_TIMEOUT_MS = 5000;
const MAX_WS_PAYLOAD = 256 * 1024 * 1024;
const SESSION_BROADCAST_THROTTLE_MS = 500;

let wss: WebSocketServer | null = null;
let port: number | null = null;
let sessionCounter = 0;
const sessions: Map<number, MobileDebugSession> = new Map();
const listeners: Set<MobileDebugListener> = new Set();
const entrySubscribers: Set<WebContents> = new Set();
const sessionSubscribers: Set<WebContents> = new Set();

interface PendingCommand {
  resolve: (value: { ok: boolean; data: unknown }) => void;
  timeout: ReturnType<typeof setTimeout>;
}
const pendingCommands: Map<string, PendingCommand> = new Map();

export async function startMobileDebugServer(): Promise<number> {
  if (wss && port) {
    return port;
  }

  port = await getAvailablePort();
  // Dev-only tool: the server binds to LAN so a phone paired via QR can reach it.
  // There is no auth yet — acceptable because pairing is developer-initiated,
  // the QR is transient, and the wire protocol carries no secrets. The WS is
  // only reachable from devices already on the same LAN as the developer.
  // TODO: add a per-session token embedded in the QR URL + verifyClient check
  //       before this ships to non-dev contexts.
  // A generous maxPayload protects the Electron process from a single oversized
  // frame without constraining legit phone telemetry (CRDT batches, perf, etc).
  wss = new WebSocketServer({ port, host: '0.0.0.0', maxPayload: MAX_WS_PAYLOAD });

  wss.on('connection', (ws: WebSocket) => {
    sessionCounter++;
    const session: MobileDebugSession = {
      id: sessionCounter,
      ws,
      sessionId: null,
      deviceName: null,
      connectedAt: new Date(),
      disconnectedAt: null,
      status: 'active',
      messageCount: 0,
    };
    sessions.set(session.id, session);
    log.info(`[mobile-debug] Session #${session.id} connected (port ${port})`);
    broadcastSessions();

    ws.on('message', (raw: Buffer) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      try {
        handleMessage(session, msg);
      } catch (err) {
        log.warn('[mobile-debug] handler error', err);
      }
    });

    ws.on('close', () => {
      log.info(
        `[mobile-debug] Session #${session.id} disconnected (${session.messageCount} messages)`,
      );
      session.status = 'ended';
      session.disconnectedAt = new Date();
      session.ws = null;
      broadcastSessions();
      setTimeout(() => {
        sessions.delete(session.id);
        broadcastSessions();
      }, SESSION_RETENTION_MS).unref?.();
    });

    ws.on('error', (err: Error) => {
      log.warn(`[mobile-debug] Session #${session.id} error:`, err.message);
    });
  });

  wss.on('error', (err: Error) => {
    log.error('[mobile-debug] Server error:', err.message);
  });

  log.info(`[mobile-debug] Listening on ws://0.0.0.0:${port}`);
  return port;
}

function handleMessage(session: MobileDebugSession, msg: Record<string, unknown>): void {
  const type = typeof msg.type === 'string' ? msg.type : undefined;
  if (type === 'SCENE_INSPECTOR_CMD_ACK') {
    if (typeof msg.id !== 'string') return;
    const resolver = pendingCommands.get(msg.id);
    if (resolver) {
      pendingCommands.delete(msg.id);
      resolver.resolve({ ok: msg.ok === true, data: msg.data ?? {} });
      clearTimeout(resolver.timeout);
    }
    return;
  }
  if (type !== 'SCENE_INSPECTOR') return;
  if (!msg.payload || typeof msg.payload !== 'object') return;

  const payload = msg.payload as Record<string, unknown>;
  let metadataChanged = false;
  if (typeof payload.sessionId === 'string' && !session.sessionId) {
    session.sessionId = payload.sessionId;
    metadataChanged = true;
  }
  const rawEntries = payload.entries;
  if (!Array.isArray(rawEntries)) return;
  const entries = rawEntries.filter(
    (e): e is Record<string, unknown> => !!e && typeof e === 'object',
  );
  if (entries.length === 0) {
    if (metadataChanged) broadcastSessions();
    return;
  }
  session.messageCount += entries.length;

  for (const entry of entries) {
    if (entry.type === 'session_start') {
      const deviceName = typeof entry.device_name === 'string' ? entry.device_name : undefined;
      if (deviceName && deviceName !== session.deviceName) {
        session.deviceName = deviceName;
        metadataChanged = true;
      }
    }
  }
  if (metadataChanged) broadcastSessions();
  else scheduleSessionBroadcast();

  for (const wc of entrySubscribers) {
    if (wc.isDestroyed()) {
      entrySubscribers.delete(wc);
      continue;
    }
    wc.send('mobileDebug:entries', { sessionId: session.id, entries });
  }

  for (const listener of listeners) {
    try {
      listener(session, entries);
    } catch (e) {
      log.warn('[mobile-debug] Listener error:', e);
    }
  }
}

export function stopMobileDebugServer(): void {
  if (wss) {
    for (const session of sessions.values()) {
      if (session.ws) session.ws.close();
      session.status = 'ended';
      session.disconnectedAt = new Date();
      session.ws = null;
    }
    wss.close();
    wss = null;
    port = null;
    if (throttledBroadcastHandle) {
      clearTimeout(throttledBroadcastHandle);
      throttledBroadcastHandle = null;
    }
    broadcastSessions();
    log.info('[mobile-debug] Stopped');
  }
}

export function getMobileDebugServerPort(): number | null {
  return port;
}

export function isMobileDebugServerRunning(): boolean {
  return wss !== null && port !== null;
}

export function getMobileDebugServerStatus(): {
  running: boolean;
  port: number | null;
  sessions: number;
} {
  return {
    running: wss !== null,
    port,
    sessions: sessions.size,
  };
}

export function getMobileDebugSessions(): MobileDebugSession[] {
  return Array.from(sessions.values());
}

function serializeSession(s: MobileDebugSession): MobileDebugSessionInfo {
  return {
    id: s.id,
    sessionId: s.sessionId,
    deviceName: s.deviceName,
    connectedAt: s.connectedAt.toISOString(),
    disconnectedAt: s.disconnectedAt?.toISOString() ?? null,
    status: s.status,
    messageCount: s.messageCount,
  };
}

export function getMobileDebugSessionInfos(): MobileDebugSessionInfo[] {
  return Array.from(sessions.values()).map(serializeSession);
}

function broadcastSessions(): void {
  if (sessionSubscribers.size === 0) return;
  if (throttledBroadcastHandle) {
    clearTimeout(throttledBroadcastHandle);
    throttledBroadcastHandle = null;
  }
  const snapshot = getMobileDebugSessionInfos();
  for (const wc of sessionSubscribers) {
    if (wc.isDestroyed()) {
      sessionSubscribers.delete(wc);
      continue;
    }
    wc.send('mobileDebug:sessions', snapshot);
  }
}

let throttledBroadcastHandle: NodeJS.Timeout | null = null;
function scheduleSessionBroadcast(): void {
  if (throttledBroadcastHandle || sessionSubscribers.size === 0) return;
  throttledBroadcastHandle = setTimeout(() => {
    throttledBroadcastHandle = null;
    broadcastSessions();
  }, SESSION_BROADCAST_THROTTLE_MS);
  throttledBroadcastHandle.unref?.();
}

export function subscribeEntries(wc: WebContents): void {
  if (entrySubscribers.has(wc)) return;
  entrySubscribers.add(wc);
  wc.once('destroyed', () => entrySubscribers.delete(wc));
}

export function unsubscribeEntries(wc: WebContents): void {
  entrySubscribers.delete(wc);
}

export function subscribeSessions(wc: WebContents): void {
  if (sessionSubscribers.has(wc)) return;
  sessionSubscribers.add(wc);
  wc.once('destroyed', () => sessionSubscribers.delete(wc));
  wc.send('mobileDebug:sessions', getMobileDebugSessionInfos());
}

export function unsubscribeSessions(wc: WebContents): void {
  sessionSubscribers.delete(wc);
}

export function addMobileDebugListener(listener: MobileDebugListener): void {
  listeners.add(listener);
}

export function removeMobileDebugListener(listener: MobileDebugListener): void {
  listeners.delete(listener);
}

export async function sendCommand(
  sessionId: number,
  cmd: string,
  args: Record<string, unknown> = {},
): Promise<{ ok: boolean; data: unknown }> {
  const session = sessions.get(sessionId);
  // Capture ws locally so the async `send` below cannot race with the `close`
  // handler nulling `session.ws` between the guard and the write.
  const ws = session?.ws;
  if (!session || session.status !== 'active' || !ws || ws.readyState !== WebSocket.OPEN) {
    return { ok: false, data: { error: 'session not connected' } };
  }

  const id = `cmd-${randomUUID()}`;
  const msg = JSON.stringify({ type: 'SCENE_INSPECTOR_CMD', id, cmd, args });

  return new Promise(resolve => {
    const timeout = setTimeout(() => {
      pendingCommands.delete(id);
      resolve({ ok: false, data: { error: 'timeout' } });
    }, COMMAND_TIMEOUT_MS);

    pendingCommands.set(id, { resolve, timeout });
    ws.send(msg);
  });
}

export async function broadcastCommand(
  cmd: string,
  args: Record<string, unknown> = {},
): Promise<BroadcastResult> {
  const sessionIds = Array.from(sessions.keys());
  if (sessionIds.length === 0) {
    return { ok: false, results: [] };
  }

  const results = await Promise.all(
    sessionIds.map(async sid => {
      const r = await sendCommand(sid, cmd, args);
      return { sessionId: sid, ok: r.ok, data: r.data };
    }),
  );
  return { ok: results.every(r => r.ok), results };
}

export async function getStandaloneDeeplink(): Promise<{ url: string; qr: string; port: number }> {
  const wsPort = await startMobileDebugServer();
  const lanIp = getLanIp();
  const sceneInspectorTarget = `ws://${lanIp}:${wsPort}`;
  const url = `decentraland://?scene-inspector=${encodeURIComponent(sceneInspectorTarget)}`;

  const QRCode = await import('qrcode');
  const qr = await QRCode.toDataURL(url, { width: 512, margin: 2 });

  return { url, qr, port: wsPort };
}
