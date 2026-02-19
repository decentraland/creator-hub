import path from 'path';
import { app } from 'electron';
import log from 'electron-log';
import { createWindow, focusWindow, getWindow } from './window';

/**
 * DevTools window handler for connecting to external CDP (Chrome DevTools Protocol) processes.
 * Used to debug Unity's CDP server by opening a DevTools frontend in a BrowserWindow.
 *
 * @see packages/creator-hub/devtools-frontend/SOLUTION.md for context on why this exists
 */

/**
 * Get the path to the devtools-frontend directory.
 * In dev: directly in the package folder
 * In prod: extraResources folder (Resources/devtools-frontend on macOS)
 */
function getDevToolsFrontendPath(): string {
  if (import.meta.env.DEV) {
    return path.join(app.getAppPath(), '..', 'devtools-frontend');
  }
  return path.join(process.resourcesPath, 'devtools-frontend');
}

/**
 * Opens a DevTools window connected to an external CDP process.
 * Uses the bundled devtools-frontend loaded via file:// protocol.
 */
export function openDevToolsWindow(port: number): void {
  try {
    const devtoolsPath = `devtools-${port}`;
    const existingWindow = getWindow(devtoolsPath);
    if (existingWindow && !existingWindow.isDestroyed()) {
      focusWindow(existingWindow);
      return;
    }

    const win = createWindow(devtoolsPath, {
      show: true,
      title: `DevTools - CDP Server (port ${port})`,
      width: 1200,
      height: 800,
      webPreferences: {
        webSecurity: false,
      },
    });

    // Log load failures for debugging connection issues
    win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      log.error('[DevTools] Failed to load:', { errorCode, errorDescription, validatedURL });
    });

    const devtoolsFrontendPath = getDevToolsFrontendPath();
    const devtoolsUrl = `file://${devtoolsFrontendPath}/devtools_app.html?ws=127.0.0.1:${port}&panel=network`;
    win.loadURL(devtoolsUrl);

    log.info('[DevTools] Window opened for port:', port);
  } catch (error) {
    log.error('[DevTools] Failed to open window:', error);
  }
}
