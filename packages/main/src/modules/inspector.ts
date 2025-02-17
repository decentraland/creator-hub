import log from 'electron-log';
import { app, type BrowserWindow } from 'electron';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { run, type Child } from './bin';
import { getAvailablePort } from './port';
import { APP_UNPACKED_PATH } from './path';
import { createWindow, focusWindow, getWindow } from './window';
import * as cache from './cache';

const debuggers: Map<string, { window: BrowserWindow; preview: Child; listener: number }> =
  new Map();

export function getDebugger(path: string) {
  return debuggers.get(path);
}

export let inspectorServer: Child | null = null;
export async function start() {
  if (inspectorServer) {
    await inspectorServer.kill();
  }

  const port = await getAvailablePort();
  inspectorServer = run('http-server', 'http-server', {
    args: ['--port', port.toString()],
    cwd: join(APP_UNPACKED_PATH, './node_modules/@dcl/inspector/public'),
  });

  await inspectorServer.waitFor(/available/i, /error/i).catch(error => log.error(error.message));

  return port;
}

export async function openSceneDebugger(path: string): Promise<string> {
  const alreadyOpen = getWindow(path);
  if (alreadyOpen) {
    focusWindow(alreadyOpen);
    return path;
  }

  const window = createWindow(path);
  window.setMenuBarVisibility(false);
  window.on('ready-to-show', () => window.show());

  if (import.meta.env.DEV && import.meta.env.VITE_DEV_SERVER_URL !== undefined) {
    const url = join(import.meta.env.VITE_DEV_SERVER_URL, `debugger.html?path=${path}`);
    await window.loadURL(url);
  } else {
    const url = new URL(
      join(app.getAppPath(), 'packages/renderer/dist/debugger.html'),
      import.meta.url,
    );
    url.searchParams.set('path', path);
    await window.loadFile(fileURLToPath(url));
  }

  return path;
}

function assertDebuggerState(path: string) {
  const window = cache.getWindow(path);
  const preview = cache.getPreview(path);

  if (!window || window.isDestroyed()) {
    throw new Error(`Window not found for path: ${path}`);
  }

  if (!preview || !preview.child.alive()) {
    throw new Error(`Preview not found for path: ${path}`);
  }
}

function isDebuggerAttached(path: string, window: BrowserWindow, preview: Child): boolean {
  const _debugger = debuggers.get(path) ?? false;
  return _debugger && _debugger.window === window && _debugger.preview === preview;
}

export async function attachSceneDebugger(path: string, eventName: string): Promise<boolean> {
  assertDebuggerState(path);

  const window = cache.getWindow(path)!;
  const { child: preview } = cache.getPreview(path)!;

  focusWindow(window);

  if (isDebuggerAttached(path, window, preview)) {
    return false;
  }

  // Attach the event listener to preview output to send the data to debugger window
  const listener = preview.on(
    /(.*)/i,
    (data?: string) => {
      if (data) window.webContents.send(eventName, data);
    },
    { sanitize: false },
  );

  debuggers.set(path, { window, preview, listener });

  const cleanup = () => debuggers.delete(path);

  window.on('closed', () => {
    // Remove the event listener from the preview when the debugger window is closed
    preview.off(listener);
    cleanup();
  });
  preview.process.on('exit', () => {
    // Destoy debugger window when the preview process exits
    window.destroy();
    cleanup();
  });

  return true;
}
