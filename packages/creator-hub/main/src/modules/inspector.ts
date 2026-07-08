import { readFile } from 'node:fs/promises';
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

  const origin = `localhost:${port}`;

  inspectorServer = createServer({
    root: inspectorPath,
    // Cross-origin isolation headers. The Bevy engine (served same-origin from the
    // inspector's public/bevy-engine) needs SharedArrayBuffer, which browsers only
    // grant to a cross-origin-isolated context. These mirror what the inspector's
    // dev build proxy sets (build.js) and what the engine's own service worker
    // targets — COEP is `credentialless` (NOT `require-corp`) so the engine's own
    // subresource loads aren't blocked. Harmless for the Babylon renderer, which
    // doesn't rely on them.
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    },
    before: [serveBevyAgentAbout(inspectorPath, origin)],
  });
  inspectorServer.listen(port, () => {
    log.info(`Inspector running at http://localhost:${port}`);
  });

  return port;
}

// The Bevy editor-agent scene ships as a static realm at public/bevy-agent
// (exported by the inspector build's copy-bevy-agent). Its realm manifest
// (`bevy-agent/about`) bakes a `__ORIGIN__` placeholder into the scene's baseUrl,
// because the server's port is only known at launch. Rewrite that one file's
// placeholder to this server's origin on the fly; every other file is
// content-addressed and served as-is. The agent realm is reached at
// `/bevy-agent/bevy-agent/about` (the export nests `<realmName>/about` under the
// served `/bevy-agent/` dir).
const AGENT_ABOUT_PATH = '/bevy-agent/bevy-agent/about';

function serveBevyAgentAbout(inspectorPath: string, origin: string) {
  const aboutFile = resolve(inspectorPath, 'bevy-agent', 'bevy-agent', 'about');
  return (req: any, res: any) => {
    const url = (req.url || '').split('?')[0];
    if (url !== AGENT_ABOUT_PATH) {
      res.emit('next');
      return;
    }
    readFile(aboutFile, 'utf8')
      .then(contents => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(contents.replaceAll('__ORIGIN__', origin));
      })
      .catch(() => {
        // Not exported (e.g. Bevy never built) — fall through to the static handler,
        // which will 404 like any missing file.
        res.emit('next');
      });
  };
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
