import { join } from 'node:path';
import { app, BrowserWindow, type BrowserWindowConstructorOptions } from 'electron';

const activeWindows = new Map<string, BrowserWindow>();

export function createWindow(path: string, options?: BrowserWindowConstructorOptions) {
  const { webPreferences, ...restOptions } = options ?? {};
  const window = new BrowserWindow({
    show: false, // Use the 'ready-to-show' event to show the instantiated BrowserWindow.
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Sandbox disabled because the demo of preload script depend on the Node.js api
      webviewTag: false, // The webview tag is not recommended. Consider alternatives like an iframe or Electron's BrowserView. @see https://www.electronjs.org/docs/latest/api/webview-tag#warning
      preload: import.meta.env.VITEST
        ? join(app.getAppPath(), '..', '..', 'preload/dist/index.mjs')
        : join(app.getAppPath(), 'preload/dist/index.mjs'),
      ...webPreferences,
    },
    ...restOptions,
  });

  // Setup active windows map. We don't want to use window.id because we want to identify the window by the path WE give it
  activeWindows.set(path, window);
  window.on('closed', () => activeWindows.delete(path));

  return window;
}

export function getWindow(path: string): BrowserWindow | undefined {
  return activeWindows.get(path);
}

export function focusWindow(window: BrowserWindow): void {
  if (window && !window.isDestroyed()) {
    if (window.isMinimized()) window.restore();
    window.focus();
  }
}

export function restoreOrCreateWindow(
  path: string,
  options?: BrowserWindowConstructorOptions,
): BrowserWindow {
  const existing = getWindow(path);
  if (existing && !existing.isDestroyed()) {
    focusWindow(existing);
    return existing;
  }
  return createWindow(path, options);
}

export function destroyAllWindows(): void {
  activeWindows.forEach(window => window.destroy());
  activeWindows.clear();
}
