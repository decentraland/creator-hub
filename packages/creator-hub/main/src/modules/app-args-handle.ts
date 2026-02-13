import path from 'path';
import { app, BrowserWindow } from 'electron';
import { Env } from '/shared/types/env';
import log from 'electron-log';

/**
 * DevTools window handler for connecting to external CDP (Chrome DevTools Protocol) processes.
 * Used to debug Unity's CDP server by opening a DevTools frontend in a BrowserWindow.
 *
 * @see packages/creator-hub/devtools-frontend/SOLUTION.md for context on why this exists
 */
/** Keep references to devtools windows to prevent garbage collection */
const devtoolsWindows: Map<number, BrowserWindow> = new Map();

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

function getArgs(argv: string[]): string[] {
  const isDev = process.defaultApp || /electron(\.exe)?$/i.test(path.basename(process.execPath));
  return isDev ? argv.slice(2) : argv.slice(1);
}

export function tryOpenDevToolsOnPort(argv: string[]): void {
  const args = getArgs(argv);

  for (const arg of args) {
    if (arg.startsWith('--open-devtools-with-port=')) {
      const portStr = arg.split('=')[1];
      const port = parseInt(portStr);

      if (isNaN(port)) {
        log.error('[DevTools] Invalid port:', portStr);
        continue;
      }

      log.info('[DevTools] Opening DevTools window for port:', port);
      openDevToolsWindow(port);
      break;
    }
  }
}

/**
 * Opens a DevTools window connected to an external CDP process.
 * Uses the bundled devtools-frontend loaded via file:// protocol.
 */
function openDevToolsWindow(port: number): void {
  try {
    // Reuse existing window if already open for this port
    if (devtoolsWindows.has(port)) {
      const existingWindow = devtoolsWindows.get(port);
      if (existingWindow && !existingWindow.isDestroyed()) {
        existingWindow.focus();
        return;
      }
    }

    const win = new BrowserWindow({
      title: `DevTools - Unity CDP (port ${port})`,
      width: 1200,
      height: 800,
      webPreferences: {
        webSecurity: false,
      },
    });

    devtoolsWindows.set(port, win);

    // Log load failures for debugging connection issues
    win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      log.error('[DevTools] Failed to load:', { errorCode, errorDescription, validatedURL });
    });

    const devtoolsFrontendPath = getDevToolsFrontendPath();
    const devtoolsUrl = `file://${devtoolsFrontendPath}/devtools_app.html?ws=127.0.0.1:${port}&panel=network`;
    win.loadURL(devtoolsUrl);

    win.on('closed', () => {
      devtoolsWindows.delete(port);
    });

    log.info('[DevTools] Window opened for port:', port);
  } catch (error) {
    log.error('[DevTools] Failed to open window:', error);
  }
}

/**
 * Parses the --env CLI argument.
 * @param argv - Command line arguments array
 * @returns 'dev', 'prod', or null if no valid override specified
 */
export function parseEnvArgument(argv: string[]): Env | null {
  const args = getArgs(argv);

  for (const arg of args) {
    if (arg.startsWith('--env=')) {
      const envValue = arg.split('=')[1] as Env;
      if (Object.values(Env).includes(envValue)) {
        log.info(`[Args] Environment override: ${envValue}`);
        return envValue;
      } else {
        log.warn(
          `[Args] Invalid environment value: ${envValue}. Must be one of: ${Object.values(Env).join('|')}`,
        );
      }
    }
  }

  return null;
}
