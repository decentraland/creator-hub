import { app } from 'electron';
import * as Sentry from '@sentry/electron/main';
import { platform } from 'node:process';
import log from 'electron-log/main';

import { restoreOrCreateMainWindow } from '/@/mainWindow';
import { initIpc } from '/@/modules/ipc';
import { deployServer, killAllPreviews } from '/@/modules/cli';
import { inspectorServer } from '/@/modules/inspector';
import { getAnalytics, track } from '/@/modules/analytics';
import { runMigrations } from '/@/modules/migrations';
import * as updater from './modules/updater';

import '/@/security-restrictions';

log.initialize();

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
app.on('second-instance', restoreOrCreateMainWindow);

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
    initIpc();
    log.info('[IPC] Ready');
    await restoreOrCreateMainWindow();
    log.info('[BrowserWindow] Ready');
    const analytics = await getAnalytics();
    if (analytics) {
      await track('Open Editor', { version: app.getVersion() });
    } else {
      log.info('[Analytics] API key not provided, analytics disabled');
    }
  })
  .catch(e => log.error('Failed create window:', e));

/**
 * Initialize the updater in both development and production modes
 */
app
  .whenReady()
  .then(() => {
    try {
      updater.checkForUpdates({
        autoDownload: false, // Set to false for manual download testing
      });
    } catch (error: any) {
      Sentry.captureException(error, {
        tags: { source: 'auto-updater' },
        extra: { context: 'Electron auto-update process main' },
      });
      log.error('[AutoUpdater] Failed check and install updates:', error.message);
    }
  })
  .catch((error: Error) => {
    log.error('[AutoUpdater] Failed to initialize updater:', error.message);
  });

export async function killAll() {
  const promises: Promise<unknown>[] = [killAllPreviews()];
  if (deployServer) {
    promises.push(deployServer.kill());
  }
  if (inspectorServer) {
    promises.push(inspectorServer.kill());
  }
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
