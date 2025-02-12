import { app, BrowserWindow, type BrowserWindowConstructorOptions } from 'electron';
import { join } from 'node:path';

import type { WindowId } from '/shared/types/window';

const windowMap = new Map<WindowId, BrowserWindow>();

export function createWindow(id: WindowId, options?: BrowserWindowConstructorOptions) {
  const browserWindow = new BrowserWindow({
    show: false, // Use the 'ready-to-show' event to show the instantiated BrowserWindow.
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Sandbox disabled because the demo of preload script depend on the Node.js api
      webviewTag: false, // The webview tag is not recommended. Consider alternatives like an iframe or Electron's BrowserView. @see https://www.electronjs.org/docs/latest/api/webview-tag#warning
      preload: join(app.getAppPath(), 'packages/preload/dist/index.mjs'),
      ...options,
    },
  });

  // Setup window map
  windowMap.set(id, browserWindow);
  browserWindow.on('closed', () => {
    windowMap.delete(id);
  });
  // Setup window map

  return browserWindow;
}

export function getWindowById(id: WindowId): BrowserWindow | undefined {
  return windowMap.get(id);
}
