import { app } from 'electron';
import { restoreOrCreateWindow } from '/@/mainWindow';
import { platform } from 'node:process';
import updater from 'electron-updater';

import './security-restrictions';
import { initIpc } from './modules/ipc';
import { killAll } from './modules/cli';

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
 * Disable Hardware Acceleration to save more system resources.
 */
app.disableHardwareAcceleration();

/**
 * Shout down background process if all windows was closed
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
    initIpc();
    await restoreOrCreateWindow();
  })
  .catch(e => console.error('Failed create window:', e));

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
    .then(() => updater.autoUpdater.checkForUpdatesAndNotify())
    .catch(e => console.error('Failed check and install updates:', e));
}
