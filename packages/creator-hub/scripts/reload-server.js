import { WebSocketServer } from 'ws';

/** @type {WebSocketServer | null} */
let wss = null;

/** @type {Set<import('ws').WebSocket>} */
const clients = new Set();

/**
 * Starts the reload signal server.
 * This WebSocket server is used to communicate reload signals
 * from the watch script to the running Electron main process.
 *
 * @returns {Promise<WebSocketServer>}
 */
export function startReloadServer(port = 9999) {
  return new Promise((resolve, reject) => {
    if (wss) {
      resolve(wss);
      return;
    }

    wss = new WebSocketServer({ port });

    wss.on('listening', () => {
      console.log(`[reload-server] Hot reload server listening on port ${port}`);
      resolve(wss);
    });

    wss.on('error', err => {
      if (err.code === 'EADDRINUSE') {
        console.warn(
          `[reload-server] Port ${port} in use, attempting to continue without reload server`,
        );
        wss = null;
        resolve(null);
      } else {
        reject(err);
      }
    });

    wss.on('connection', ws => {
      clients.add(ws);
      console.log(`[reload-server] Client connected (total: ${clients.size})`);

      ws.on('close', () => {
        clients.delete(ws);
        console.log(`[reload-server] Client disconnected (total: ${clients.size})`);
      });

      ws.on('error', err => {
        console.error('[reload-server] Client error:', err.message);
        clients.delete(ws);
      });
    });
  });
}

/**
 * Sends a reload signal to all connected clients (Electron main processes).
 * This triggers a window reload instead of a full app restart.
 */
export function sendReloadSignal() {
  if (clients.size === 0) {
    console.log('[reload-server] No clients connected, cannot send reload signal');
    return false;
  }

  const message = JSON.stringify({ type: 'main-reload', timestamp: Date.now() });

  for (const client of clients) {
    if (client.readyState === client.OPEN) {
      client.send(message);
    } else {
      clients.delete(client);
    }
  }

  console.log(`[reload-server] Sent reload signal to ${clients.size} client(s)`);
  return true;
}

/**
 * Stops the reload server and closes all connections.
 */
export function stopReloadServer() {
  if (wss) {
    for (const client of clients) {
      client.close();
    }
    clients.clear();
    wss.close();
    wss = null;
    console.log('[reload-server] Server stopped');
  }
}
