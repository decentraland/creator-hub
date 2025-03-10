import { app } from 'electron';
import * as Sentry from '@sentry/electron/main';
import { platform } from 'node:process';
import updater from 'electron-updater';
import log from 'electron-log/main';

import { restoreOrCreateMainWindow } from '/@/mainWindow';
import { initIpc } from '/@/modules/ipc';
import { deployServer, killAllPreviews } from '/@/modules/cli';
import { inspectorServer } from '/@/modules/inspector';
import { getAnalytics, track } from '/@/modules/analytics';
import { runMigrations } from '/@/modules/migrations';

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
 * Check for app updates, install it in background and notify user that new version was installed.
 * No reason run this in non-production build.
 * @see https://www.electron.build/auto-update.html#quick-setup-guide
 *
 * Note: It may throw "ENOENT: no such file app-update.yml"
 * if you compile production app without publishing it to distribution server.
 * Like `npm run compile` does. It's ok 😅
 */
if (import.meta.env.PROD) {
    app
    .whenReady()
    .then(() => {
      updater.autoUpdater.on('checking-for-update', () => {
        log.info('[AutoUpdater] Checking for updates');
      });
      updater.autoUpdater.on('update-available', _info => {
        log.info('[AutoUpdater] Update available');
      });
      updater.autoUpdater.on('update-not-available', _info => {
        log.info('[AutoUpdater] Update not available');
      });
      updater.autoUpdater.on('update-downloaded', async info => {
        log.info(`[AutoUpdater] Update downloaded (v${info.version})`);
        await track('Auto Update Editor', { version: info.version });
      });
      updater.autoUpdater.on('download-progress', info => {
        log.info(`[AutoUpdater] Download progress ${info.percent.toFixed(2)}%`);
      });
      updater.autoUpdater.on('error', err => {
        Sentry.captureException(err, {
          tags: { source: 'auto-updater' },
          extra: { context: 'Electron auto-update process' },
        });
        log.error('[AutoUpdater] Error in auto-updater', err);
      });
      return updater.autoUpdater.checkForUpdatesAndNotify({
        title: 'Update available',
        body: 'New version was installed. Restart the app to apply changes.',
      });
    })
    .catch(error => {
      Sentry.captureException(error, {
        tags: { source: 'auto-updater' },
        extra: { context: 'Electron auto-update process main' },
      });
      log.error('[AutoUpdater] Failed check and install updates:', error.message);
    });
} else {
  log.info('Skipping updates check in DEV mode');
}

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
