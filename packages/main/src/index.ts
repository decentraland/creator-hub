import { app } from 'electron';
import { restoreOrCreateWindow } from '/@/mainWindow';
import { platform } from 'node:process';
import updater from 'electron-updater';
import log from 'electron-log/main';

import './security-restrictions';
import { initIpc } from './modules/ipc';
import { deployServer, previewServer } from './modules/cli';
import { inspectorServer } from './modules/inspector';

log.initialize();

/**
 * Prevent electron from running multiple instances.
 */
const isSingleInstance = app.requestSingleInstanceLock();
if (!isSingleInstance) {
  app.quit();
  process.exit(0);
}
app.on('second-instance', restoreOrCreateWindow);

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
app.on('activate', restoreOrCreateWindow);

/**
 * Create the application window when app is ready.
 */

app
  .whenReady()
  .then(async () => {
    log.info(`[App] Ready v${app.getVersion()}`);
    initIpc();
    log.info('[IPC] Ready');
    await restoreOrCreateWindow();
    log.info('[BrowserWindow] Ready');
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
      updater.autoUpdater.on('update-downloaded', _info => {
        log.info('[AutoUpdater] Update downloaded');
      });
      updater.autoUpdater.on('download-progress', info => {
        log.info(`[AutoUpdater] Download progress ${info.percent}%`);
      });
      updater.autoUpdater.on('error', err => {
        log.error('[AutoUpdater] Error in auto-updater', err);
      });
      return updater.autoUpdater.checkForUpdatesAndNotify({
        title: 'Update available',
        body: 'New version was installed. Restart the app to apply changes.',
      });
    })
    .catch(error => log.error('[AutoUpdater] Failed check and install updates:', error.message));
} else {
  log.info('Skipping updates check in DEV mode');
}

export async function killAll() {
  const promises = [];
  if (previewServer) {
    promises.push(previewServer.kill());
  }
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
    log.error('[App] Failed to kill all servers:', error);
  }
  log.info('[App] Quit');
  app.exit();
});
