import { randomUUID } from 'node:crypto';

import { WebSocketServer, WebSocket } from 'ws';
import type { WebContents } from 'electron';
import log from 'electron-log/main';
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

export interface ConsoleEntry {
  sessionId: number;
  timestamp: number;
  level: 'log' | 'error';
  message: string;
}

export interface MonitorStats {
  totalEntries: number;
  totalCrdt: number;
  totalOpCalls: number;
  totalConsoleLogs: number;
  activeSessions: number;
  entriesPerSecond: number;
}

export interface BroadcastResult {
  ok: boolean;
  results: { sessionId: number; ok: boolean; data: unknown }[];
}

export type MobileDebugListener = (session: MobileDebugSession, entries: unknown[]) => void;

const MAX_CONSOLE_ENTRIES = 1000;
const MAX_RAW_ENTRIES = 5000;
const SESSION_RETENTION_MS = 60_000;
const COMMAND_TIMEOUT_MS = 5000;
const DEFAULT_PAGE_LIMIT = 256;
const MAX_PAGE_LIMIT = 1024;
const MAX_WS_PAYLOAD = 256 * 1024 * 1024;
const RAW_SID_KEY = '__sessionId';

let wss: WebSocketServer | null = null;
let port: number | null = null;
let sessionCounter = 0;
const sessions: Map<number, MobileDebugSession> = new Map();
const listeners: Set<MobileDebugListener> = new Set();
const entrySubscribers: Set<WebContents> = new Set();

const consoleBuffer: ConsoleEntry[] = [];
let consoleTotalCount = 0;

const rawEntryBuffer: Record<string, unknown>[] = [];
let rawTotalCount = 0;

let totalEntries = 0;
let totalCrdt = 0;
let totalOpCalls = 0;
let totalConsoleLogs = 0;
let entriesLastSecond = 0;
let entriesPerSecond = 0;
let lastSecondTimestamp = Date.now();
let throughputIntervalHandle: NodeJS.Timeout | null = null;

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
      setTimeout(() => {
        sessions.delete(session.id);
        pruneBuffersForSession(session.id);
      }, SESSION_RETENTION_MS).unref?.();
    });

    ws.on('error', (err: Error) => {
      log.warn(`[mobile-debug] Session #${session.id} error:`, err.message);
    });
  });

  if (!throughputIntervalHandle) {
    throughputIntervalHandle = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - lastSecondTimestamp) / 1000;
      entriesPerSecond = elapsed > 0 ? Math.round(entriesLastSecond / elapsed) : 0;
      entriesLastSecond = 0;
      lastSecondTimestamp = now;
    }, 1000);
  }

  wss.on('error', (err: Error) => {
    log.error('[mobile-debug] Server error:', err.message);
  });

  log.info(`[mobile-debug] Listening on ws://0.0.0.0:${port}`);
  return port;
}

function handleMessage(session: MobileDebugSession, msg: Record<string, unknown>): void {
  const type = msg.type as string | undefined;
  if (type === 'SCENE_INSPECTOR_CMD_ACK') {
    const id = msg.id as string;
    const resolver = pendingCommands.get(id);
    if (resolver) {
      pendingCommands.delete(id);
      resolver.resolve({ ok: (msg.ok as boolean) ?? false, data: msg.data ?? {} });
      clearTimeout(resolver.timeout);
    }
    return;
  }
  if (type !== 'SCENE_INSPECTOR' || !msg.payload) return;

  const payload = msg.payload as Record<string, unknown>;
  if (typeof payload.sessionId === 'string' && !session.sessionId) {
    session.sessionId = payload.sessionId;
  }
  const entries = (payload.entries ?? []) as Record<string, unknown>[];
  session.messageCount += entries.length;
  totalEntries += entries.length;
  entriesLastSecond += entries.length;

  for (const entry of entries) {
    Object.defineProperty(entry, RAW_SID_KEY, {
      value: session.id,
      enumerable: false,
      configurable: true,
      writable: true,
    });
    rawEntryBuffer.push(entry);
  }
  rawTotalCount += entries.length;
  if (rawEntryBuffer.length > MAX_RAW_ENTRIES) {
    rawEntryBuffer.splice(0, rawEntryBuffer.length - MAX_RAW_ENTRIES);
  }

  for (const entry of entries) {
    const entryType = entry.type as string;
    if (entryType === 'session_start') {
      const deviceName = entry.device_name as string | undefined;
      if (deviceName) session.deviceName = deviceName;
    } else if (entryType === 'crdt') {
      totalCrdt++;
    } else if (entryType === 'op_call_start') {
      totalOpCalls++;
      const opName = entry.op_name as string;
      if (opName === 'op_log' || opName === 'op_error') {
        totalConsoleLogs++;
        const message = formatConsoleArgs(entry.args);
        const tsRaw = entry.timestamp_ms;
        const consoleEntry: ConsoleEntry = {
          sessionId: session.id,
          timestamp: typeof tsRaw === 'number' ? tsRaw : Date.now(),
          level: opName === 'op_error' ? 'error' : 'log',
          message,
        };
        consoleBuffer.push(consoleEntry);
        consoleTotalCount++;
        if (consoleBuffer.length > MAX_CONSOLE_ENTRIES) {
          consoleBuffer.shift();
        }
      }
    }
  }

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

function pruneBuffersForSession(sessionId: number): void {
  let write = 0;
  for (let read = 0; read < consoleBuffer.length; read++) {
    const e = consoleBuffer[read];
    if (e.sessionId !== sessionId) {
      consoleBuffer[write++] = e;
    }
  }
  consoleBuffer.length = write;

  let rwrite = 0;
  for (let read = 0; read < rawEntryBuffer.length; read++) {
    const e = rawEntryBuffer[read];
    if ((e as Record<string, unknown>)[RAW_SID_KEY] !== sessionId) {
      rawEntryBuffer[rwrite++] = e;
    }
  }
  rawEntryBuffer.length = rwrite;
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
    if (throughputIntervalHandle) {
      clearInterval(throughputIntervalHandle);
      throughputIntervalHandle = null;
    }
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

function clampLimit(limit: number | undefined): number {
  const l = typeof limit === 'number' && Number.isFinite(limit) ? limit : DEFAULT_PAGE_LIMIT;
  return Math.min(Math.max(Math.floor(l), 1), MAX_PAGE_LIMIT);
}

export function getConsoleEntries(
  afterIndex: number,
  limit?: number,
): { entries: ConsoleEntry[]; nextIndex: number; hasMore: boolean } {
  const cap = clampLimit(limit);
  const bufferStart = consoleTotalCount - consoleBuffer.length;
  const effectiveStart = Math.max(afterIndex, bufferStart);
  const startOffset = effectiveStart - bufferStart;
  const entries = consoleBuffer.slice(startOffset, startOffset + cap);
  const nextIndex = effectiveStart + entries.length;
  return { entries, nextIndex, hasMore: nextIndex < consoleTotalCount };
}

export function getMonitorStats(): MonitorStats {
  return {
    totalEntries,
    totalCrdt,
    totalOpCalls,
    totalConsoleLogs,
    activeSessions: Array.from(sessions.values()).filter(s => s.status === 'active').length,
    entriesPerSecond,
  };
}

export function getRawEntries(
  afterIndex: number,
  limit?: number,
): { entries: unknown[]; nextIndex: number; hasMore: boolean } {
  const cap = clampLimit(limit);
  const bufferStart = rawTotalCount - rawEntryBuffer.length;
  const effectiveStart = Math.max(afterIndex, bufferStart);
  const startOffset = effectiveStart - bufferStart;
  const entries = rawEntryBuffer.slice(startOffset, startOffset + cap);
  const nextIndex = effectiveStart + entries.length;
  return { entries, nextIndex, hasMore: nextIndex < rawTotalCount };
}

export function clearMobileDebugData(): void {
  consoleBuffer.length = 0;
  consoleTotalCount = 0;
  rawEntryBuffer.length = 0;
  rawTotalCount = 0;
  totalEntries = 0;
  totalCrdt = 0;
  totalOpCalls = 0;
  totalConsoleLogs = 0;
  entriesLastSecond = 0;
  entriesPerSecond = 0;
  lastSecondTimestamp = Date.now();
}

export function subscribeEntries(wc: WebContents): void {
  if (entrySubscribers.has(wc)) return;
  entrySubscribers.add(wc);
  wc.once('destroyed', () => entrySubscribers.delete(wc));
}

export function unsubscribeEntries(wc: WebContents): void {
  entrySubscribers.delete(wc);
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
  if (
    !session ||
    session.status !== 'active' ||
    !session.ws ||
    session.ws.readyState !== WebSocket.OPEN
  ) {
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
    session.ws!.send(msg);
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

function formatConsoleArgs(args: unknown): string {
  if (args == null) return '';
  if (Array.isArray(args)) {
    return args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  }
  if (typeof args === 'string') return args;
  return JSON.stringify(args);
}
