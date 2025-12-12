import { BrowserWindow } from 'electron';
import log from 'electron-log/main';
import WebSocket from 'ws';

const RELOAD_SERVER_PORT = parseInt(import.meta.env.VITE_DEV_RELOAD_PORT || '9999', 10);
const RECONNECT_INTERVAL = 2000;

let ws: WebSocket | null = null;
let reconnectTimeout: NodeJS.Timeout | null = null;
let isShuttingDown = false;

/**
 * Reloads all open BrowserWindow instances.
 * This is called when the main process code changes,
 * allowing the renderer to reconnect with updated IPC handlers.
 */
function reloadAllWindows(): void {
  const windows = BrowserWindow.getAllWindows();
  log.info(`[dev-hot-reload] Reloading ${windows.length} window(s)...`);

  for (const window of windows) {
    if (!window.isDestroyed()) {
      window.webContents.reload();
    }
  }
}

/**
 * Connects to the reload signal server.
 * Automatically reconnects if the connection is lost.
 */
function connect(): void {
  if (isShuttingDown) return;

  try {
    ws = new WebSocket(`ws://localhost:${RELOAD_SERVER_PORT}`);

    ws.on('open', () => {
      log.info('[dev-hot-reload] Connected to reload server');
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
    });

    ws.on('message', (data: WebSocket.RawData) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === 'main-reload') {
          log.info('[dev-hot-reload] Received reload signal, reloading windows...');
          reloadAllWindows();
        }
      } catch (err) {
        log.error('[dev-hot-reload] Failed to parse message:', err);
      }
    });

    ws.on('close', () => {
      log.info('[dev-hot-reload] Disconnected from reload server');
      ws = null;
      scheduleReconnect();
    });

    ws.on('error', (err: Error) => {
      // ECONNREFUSED is expected when the reload server isn't running yet
      if ((err as NodeJS.ErrnoException).code !== 'ECONNREFUSED') {
        log.error('[dev-hot-reload] WebSocket error:', err.message);
      }
      ws?.close();
    });
  } catch (err) {
    log.error('[dev-hot-reload] Failed to create WebSocket:', err);
    scheduleReconnect();
  }
}

/**
 * Schedules a reconnection attempt after a delay.
 */
function scheduleReconnect(): void {
  if (isShuttingDown || reconnectTimeout) return;

  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    connect();
  }, RECONNECT_INTERVAL);
}

/**
 * Initializes the development hot reload system.
 * This should only be called in development mode.
 *
 * The hot reload system:
 * 1. Connects to the reload signal server (started by watch.js)
 * 2. Listens for 'main-reload' signals
 * 3. Reloads all BrowserWindow instances when signaled
 *
 * This allows the main process to be "hot reloaded" without
 * completely restarting the Electron application.
 */
export function initDevHotReload(): void {
  if (import.meta.env.PROD) {
    log.warn('[dev-hot-reload] Attempted to init in production mode, skipping');
    return;
  }

  log.info('[dev-hot-reload] Initializing development hot reload...');
  connect();

  // Clean up on app quit
  process.on('beforeExit', () => {
    shutdown();
  });
}

/**
 * Shuts down the hot reload system.
 */
export function shutdown(): void {
  isShuttingDown = true;

  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  if (ws) {
    ws.close();
    ws = null;
  }
}
