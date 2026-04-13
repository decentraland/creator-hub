import os from 'os';

import { WebSocketServer, type WebSocket } from 'ws';
import { BrowserWindow } from 'electron';
import log from 'electron-log/main';
import { getAvailablePort } from './port';

export interface SceneLogSession {
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

export type SceneLogListener = (session: SceneLogSession, entries: unknown[]) => void;

const MAX_CONSOLE_ENTRIES = 1000;

let wss: WebSocketServer | null = null;
let port: number | null = null;
let sessionCounter = 0;
const sessions: Map<number, SceneLogSession> = new Map();
const listeners: Set<SceneLogListener> = new Set();

// Console log buffer — ring buffer of recent console entries
const consoleBuffer: ConsoleEntry[] = [];
// eslint-disable-next-line prefer-const -- used as monotonic cursor for polling
let _consoleReadCursor = 0;
let consoleTotalCount = 0;

// Monitor stats
let totalEntries = 0;
let totalCrdt = 0;
let totalOpCalls = 0;
let totalConsoleLogs = 0;
let entriesLastSecond = 0;
let entriesPerSecond = 0;
let lastSecondTimestamp = Date.now();

export async function startSceneLogServer(): Promise<number> {
  if (wss && port) {
    return port;
  }

  port = await getAvailablePort();
  wss = new WebSocketServer({ port, host: '0.0.0.0' });

  wss.on('connection', (ws: WebSocket) => {
    sessionCounter++;
    const session: SceneLogSession = {
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
    log.info(`[SceneLogServer] Session #${session.id} connected (port ${port})`);

    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'SCENE_LOG_CMD_ACK') {
          // Resolve pending command promise
          const resolver = pendingCommands.get(msg.id);
          if (resolver) {
            pendingCommands.delete(msg.id);
            resolver.resolve({ ok: msg.ok ?? false, data: msg.data ?? {} });
            clearTimeout(resolver.timeout);
          }
        } else if (msg.type === 'SCENE_LOG' && msg.payload) {
          const payload = msg.payload;
          if (payload.sessionId && !session.sessionId) {
            session.sessionId = payload.sessionId;
          }
          const entries = (payload.entries ?? []) as Record<string, unknown>[];
          session.messageCount += entries.length;
          totalEntries += entries.length;
          entriesLastSecond += entries.length;

          // Buffer raw entries for renderer polling
          rawEntryBuffer.push(...entries);
          rawTotalCount += entries.length;
          if (rawEntryBuffer.length > MAX_RAW_ENTRIES) {
            rawEntryBuffer.splice(0, rawEntryBuffer.length - MAX_RAW_ENTRIES);
          }

          // Categorize entries
          for (const entry of entries) {
            const type = entry.type as string;
            if (type === 'session_start') {
              const deviceName = entry.device_name as string | undefined;
              if (deviceName) session.deviceName = deviceName;
            } else if (type === 'crdt') {
              totalCrdt++;
            } else if (type === 'op_call_start') {
              totalOpCalls++;
              const opName = entry.op_name as string;
              // Capture console.log and console.error
              if (opName === 'op_log' || opName === 'op_error') {
                totalConsoleLogs++;
                const args = entry.args as unknown;
                const message = formatConsoleArgs(args);
                const consoleEntry: ConsoleEntry = {
                  sessionId: session.id,
                  timestamp: (entry.timestamp_ms as number) || Date.now(),
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

          // Push to renderer windows immediately (no polling needed)
          for (const win of BrowserWindow.getAllWindows()) {
            win.webContents.send('sceneLog:entries', { sessionId: session.id, entries });
          }

          // Notify listeners
          for (const listener of listeners) {
            try {
              listener(session, entries);
            } catch (e) {
              log.warn('[SceneLogServer] Listener error:', e);
            }
          }
        }
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on('close', () => {
      log.info(
        `[SceneLogServer] Session #${session.id} disconnected (${session.messageCount} messages)`,
      );
      session.status = 'ended';
      session.disconnectedAt = new Date();
      session.ws = null;
    });

    ws.on('error', (err: Error) => {
      log.warn(`[SceneLogServer] Session #${session.id} error:`, err.message);
    });
  });

  // Update entries/second every second
  setInterval(() => {
    const now = Date.now();
    const elapsed = (now - lastSecondTimestamp) / 1000;
    entriesPerSecond = elapsed > 0 ? Math.round(entriesLastSecond / elapsed) : 0;
    entriesLastSecond = 0;
    lastSecondTimestamp = now;
  }, 1000);

  wss.on('error', (err: Error) => {
    log.error('[SceneLogServer] Server error:', err.message);
  });

  log.info(`[SceneLogServer] Listening on ws://0.0.0.0:${port}`);
  return port;
}

export function stopSceneLogServer(): void {
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
    log.info('[SceneLogServer] Stopped');
  }
}

export function getSceneLogServerPort(): number | null {
  return port;
}

export function isSceneLogServerRunning(): boolean {
  return wss !== null && port !== null;
}

export function getSceneLogServerStatus(): {
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

export function getSceneLogSessions(): SceneLogSession[] {
  return Array.from(sessions.values());
}

/**
 * Get console entries added after `afterIndex`.
 * Returns { entries, nextIndex } for cursor-based polling.
 */
export function getConsoleEntries(afterIndex: number): {
  entries: ConsoleEntry[];
  nextIndex: number;
} {
  // afterIndex is relative to consoleTotalCount
  const bufferStart = consoleTotalCount - consoleBuffer.length;
  const startOffset = Math.max(0, afterIndex - bufferStart);
  const entries = consoleBuffer.slice(startOffset);
  return { entries, nextIndex: consoleTotalCount };
}

/** Get current monitor stats snapshot. */
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

// Raw entry buffer for forwarding all entries to renderer
const MAX_RAW_ENTRIES = 5000;
const rawEntryBuffer: unknown[] = [];
let rawTotalCount = 0;

/**
 * Get raw entries added after `afterIndex` (all types, not just console).
 */
export function getRawEntries(afterIndex: number): { entries: unknown[]; nextIndex: number } {
  const bufferStart = rawTotalCount - rawEntryBuffer.length;
  const startOffset = Math.max(0, afterIndex - bufferStart);
  const entries = rawEntryBuffer.slice(startOffset);
  return { entries, nextIndex: rawTotalCount };
}

/** Clear all buffered data. */
export function clearSceneLogData(): void {
  consoleBuffer.length = 0;
  consoleTotalCount = 0;
  rawEntryBuffer.length = 0;
  rawTotalCount = 0;
  totalEntries = 0;
  totalCrdt = 0;
  totalOpCalls = 0;
  totalConsoleLogs = 0;
}

export function addSceneLogListener(listener: SceneLogListener): void {
  listeners.add(listener);
}

export function removeSceneLogListener(listener: SceneLogListener): void {
  listeners.delete(listener);
}

// ── Bidirectional Commands ─────────────────────────────────────────

interface PendingCommand {
  resolve: (value: { ok: boolean; data: unknown }) => void;
  timeout: ReturnType<typeof setTimeout>;
}

const pendingCommands: Map<string, PendingCommand> = new Map();
let commandCounter = 0;

const COMMAND_TIMEOUT_MS = 5000;

/**
 * Send a command to a specific session and wait for its ACK.
 */
export async function sendCommand(
  sessionId: number,
  cmd: string,
  args: Record<string, unknown> = {},
): Promise<{ ok: boolean; data: unknown }> {
  const session = sessions.get(sessionId);
  if (!session || session.status !== 'active' || !session.ws || session.ws.readyState !== 1) {
    return { ok: false, data: { error: 'session not connected' } };
  }

  const id = `cmd-${++commandCounter}`;
  const msg = JSON.stringify({ type: 'SCENE_LOG_CMD', id, cmd, args });

  return new Promise(resolve => {
    const timeout = setTimeout(() => {
      pendingCommands.delete(id);
      resolve({ ok: false, data: { error: 'timeout' } });
    }, COMMAND_TIMEOUT_MS);

    pendingCommands.set(id, { resolve, timeout });
    session.ws!.send(msg);
  });
}

/**
 * Send a command to all connected sessions. Returns the first ACK received.
 */
export async function broadcastCommand(
  cmd: string,
  args: Record<string, unknown> = {},
): Promise<{ ok: boolean; data: unknown }> {
  const sessionIds = Array.from(sessions.keys());
  if (sessionIds.length === 0) {
    return { ok: false, data: { error: 'no sessions connected' } };
  }

  // Send to all, return first response
  const results = await Promise.all(sessionIds.map(sid => sendCommand(sid, cmd, args)));
  return results.find(r => r.ok) ?? results[0];
}

/**
 * Get the deeplink URL and QR code for standalone scene inspection.
 * Starts the WS server if not already running.
 */
export async function getStandaloneDeeplink(): Promise<{ url: string; qr: string; port: number }> {
  const wsPort = await startSceneLogServer();
  const lanIp = getLanIp();
  const sceneLoggingTarget = `ws://${lanIp}:${wsPort}`;
  const url = `decentraland://?scene-logging=${encodeURIComponent(sceneLoggingTarget)}`;

  const QRCode = await import('qrcode');
  const qr = await QRCode.toDataURL(url, { width: 512, margin: 2 });

  return { url, qr, port: wsPort };
}

function getLanIp(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

function formatConsoleArgs(args: unknown): string {
  if (args == null) return '';
  if (Array.isArray(args)) {
    // op_log/op_error args are typically [level, message] or [message]
    return args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  }
  if (typeof args === 'string') return args;
  return JSON.stringify(args);
}
