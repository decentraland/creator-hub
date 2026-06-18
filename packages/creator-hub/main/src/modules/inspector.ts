import { resolve } from 'node:path';
import { app } from 'electron';
import { createServer } from 'http-server';
import log from 'electron-log';

import { MAIN_WINDOW_ID } from '../mainWindow';

import type { Child } from './bin';
import * as cache from './cache';
import { getAvailablePort } from './port';
import { getWindow } from './window';

type DebuggerState = { preview: Child; listener: number; exitHandler: () => void };

const debuggers: Map<string, DebuggerState> = new Map();

let inspectorServer: ReturnType<typeof createServer> | null = null;

export function killInspectorServer() {
  if (!inspectorServer) {
    return;
  }

  try {
    // Close the server and handle any errors
    inspectorServer.close(err => {
      if (err) {
        log.error('Error closing inspector server:', err);
      } else {
        log.info('Inspector server closed successfully');
      }
    });

    // Clear the reference
    inspectorServer = null;
  } catch (error) {
    log.error('Error killing inspector server:', error);
  }
}

export async function start() {
  if (inspectorServer) {
    killInspectorServer();
  }

  const port = await getAvailablePort();
  let inspectorPath = '';

  if (import.meta.env.DEV) {
    inspectorPath = resolve(app.getAppPath(), '..', '..', 'packages', 'inspector', 'public');
  } else {
    inspectorPath = resolve(app.getAppPath(), 'node_modules', '@dcl', 'inspector', 'public');
  }

  inspectorServer = createServer({ root: inspectorPath });
  inspectorServer.listen(port, () => {
    log.info(`Inspector running at http://localhost:${port}`);
  });

  return port;
}

function getDebuggerChannel(path: string) {
  return `debugger://${path}`;
}

export async function attachSceneDebugger(path: string): Promise<string> {
  const mainWindow = getWindow(MAIN_WINDOW_ID);
  const preview = cache.getPreview(path);

  if (!mainWindow || mainWindow.isDestroyed()) {
    throw new Error('Main window not found');
  }

  if (!preview || !preview.child.alive()) {
    throw new Error(`Preview not found for path: ${path}`);
  }

  const eventName = getDebuggerChannel(path);
  const { child } = preview;

  detachSceneDebugger(path);

  // Send all the current logs to the main window
  const stdall = child.stdall({ sanitize: false });
  if (stdall.length > 0) {
    mainWindow.webContents.send(eventName, stdall);
  }

  // Attach the event listener to preview output to send future logs to main window
  const listener = child.on(
    /(.*)/i,
    (data?: string) => {
      if (data && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(eventName, data);
      }
    },
    { sanitize: false },
  );

  const exitHandler = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(eventName, '\n--- Process exited ---\n');
    }
    detachSceneDebugger(path);
  };

  debuggers.set(path, { preview: child, listener, exitHandler });
  child.process.once('exit', exitHandler);

  return eventName;
}

export function detachSceneDebugger(path: string): void {
  const existing = debuggers.get(path);
  if (existing) {
    existing.preview.off(existing.listener);
    existing.preview.process.off('exit', existing.exitHandler);
    debuggers.delete(path);
  }
}
