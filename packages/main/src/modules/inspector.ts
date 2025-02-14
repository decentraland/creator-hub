import log from 'electron-log';
import { app } from 'electron';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { run, type Child } from './bin';
import { getAvailablePort } from './port';
import { APP_UNPACKED_PATH } from './path';
import { createWindow } from './window';
import * as cache from './cache';

const debuggers: Set<string> = new Set();

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
  const window = createWindow(path);
  window.setMenuBarVisibility(false);
  window.on('ready-to-show', () => window.show());

  if (import.meta.env.DEV && import.meta.env.VITE_DEV_SERVER_URL !== undefined) {
    const url = join(import.meta.env.VITE_DEV_SERVER_URL, `debugger.html?path=${path}`);
    await window.loadURL(url);
  } else {
    const url = new URL(join(app.getAppPath(), 'packages/renderer/dist/debugger.html'), import.meta.url);
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

export async function attachToSceneDebugger(path: string, eventName: string): Promise<boolean> {
  assertDebuggerState(path);

  const window = cache.getWindow(path)!;
  const preview = cache.getPreview(path)!;

  if (window.isMinimized()) window.restore();
  window.focus();

  if (debuggers.has(path)) {
    return false; // already attached
  } else {
    preview.child.on(
      /(.*)/i,
      (data?: string) => {
        if (data) window.webContents.send(eventName, data);
      },
      { sanitize: false },
    );

    debuggers.add(path);

    // IMPORTANT: remove the debugger from the set when the window is closed or the preview process exits
    window.on('closed', () => debuggers.delete(path));
    preview.child.process.on('exit', () => debuggers.delete(path));

    return true;
  }
}
