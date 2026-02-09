import { platform } from 'node:process';
import { app } from 'electron';
import * as Sentry from '@sentry/electron/main';
import log from 'electron-log/main';

import { restoreOrCreateMainWindow } from '/@/mainWindow';
import { killAllUtilityProcesses } from '/@/modules/bin';
import { initIpc } from '/@/modules/ipc';
import { deployServer, killAllPreviews } from '/@/modules/cli';
import { killInspectorServer } from '/@/modules/inspector';
import { runMigrations } from '/@/modules/migrations';
import { getAnalytics, track } from './modules/analytics';
import { tryOpenDevToolsOnPort, parseEnvArgument } from './modules/app-args-handle';
import { addEditorsPathsToConfig } from './modules/code';

import '/@/security-restrictions';

log.initialize();

// Store environment override from CLI arguments
let envOverride: 'dev' | 'prod' | null = null;

export function getEnvOverride() {
  return envOverride;
}

if (import.meta.env.PROD) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
  });
}

/**
 * Prevent electron from running multiple instances.
 */
const isSingleInstance = app.requestSingleInstanceLock();
if (!isSingleInstance) {
  app.quit();
  process.exit(0);
}
app.on('second-instance', async (_e: unknown, argv: string[]) => {
  await restoreOrCreateMainWindow();

  const newEnvOverride = parseEnvArgument(argv);
  if (newEnvOverride) {
    envOverride = newEnvOverride;
  }

  tryOpenDevToolsOnPort(argv);
});

/**
 * Shut down background process if all windows was closed
 */
app.on('window-all-closed', async () => {
  await killAll();
  if (platform !== 'darwin') {
    app.quit();
  }
});

/**
 * @see https://www.electronjs.org/docs/latest/api/app#event-activate-macos Event: 'activate'.
 */
app.on('activate', restoreOrCreateMainWindow);

/**
 * Create the application window when app is ready.
 */

app
  .whenReady()
  .then(async () => {
    await runMigrations();
    log.info(`[App] Ready v${app.getVersion()}`);

    envOverride = parseEnvArgument(process.argv);

    initIpc();
    log.info('[IPC] Ready');
    await restoreOrCreateMainWindow();
    log.info('[BrowserWindow] Ready');
    await addEditorsPathsToConfig();
    const analytics = await getAnalytics();
    if (analytics) {
      await track('Open Editor', { version: app.getVersion() });
    } else {
      log.info('[Analytics] API key not provided, analytics disabled');
    }

    tryOpenDevToolsOnPort(process.argv);
  })
  .catch(e => log.error('Failed create window:', e));

export async function killAll() {
  const promises: Promise<unknown>[] = [killAllPreviews()];
  if (deployServer) {
    promises.push(deployServer.stop());
  }
  killInspectorServer();
  promises.push(killAllUtilityProcesses());
  await Promise.all(promises);
}

app.on('before-quit', async event => {
  event.preventDefault();
  try {
    await killAll();
  } catch (error) {
    Sentry.captureException(error, {
      tags: { source: 'before-quit' },
      extra: { context: 'Before quit error' },
    });
    log.error('[App] Failed to kill all servers:', error);
  }
  log.info('[App] Quit');
  app.exit();
});
