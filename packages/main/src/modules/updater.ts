import updater from 'electron-updater';
import log from 'electron-log/main';
import * as Sentry from '@sentry/electron/main';

export let downloadedVersion: string | null = null;

export function getDownloadedVersion() {
  return downloadedVersion;
}

export function setDownloadedVersion(version: string | null) {
  downloadedVersion = version;
}

export interface UpdaterConfig {
  autoDownload?: boolean;
}

function setupUpdaterEvents(event?: Electron.IpcMainInvokeEvent) {
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
    setDownloadedVersion(info.version);
    event && event.sender.send('updater.downloadProgress', { percent: 100, finished: true });
  });

  updater.autoUpdater.on('download-progress', info => {
    const percent = info.percent.toFixed(2);
    log.info(`[AutoUpdater] Download progress ${percent}%`);
    event && event.sender.send('updater.downloadProgress', { percent, finished: false });
  });

  updater.autoUpdater.on('error', err => {
    Sentry.captureException(err, {
      tags: { source: 'auto-updater' },
      extra: { context: 'Electron auto-update process' },
    });
    log.error('[AutoUpdater] Error in auto-updater', err);
  });
}

function configureUpdater(config: UpdaterConfig) {
  const { autoDownload } = config;

  updater.autoUpdater.autoDownload = autoDownload ?? false;
  updater.autoUpdater.autoInstallOnAppQuit = false;
  //TODO REMOVE THIS
  updater.autoUpdater.forceDevUpdateConfig = true;
  //TODO REMOVE THIS
  updater.autoUpdater.setFeedURL(
    'https://github.com/decentraland/creator-hub/releases/download/0.14.2',
  );
}

export async function checkForUpdates(
  event: Electron.IpcMainInvokeEvent,
  config: UpdaterConfig = {},
) {
  try {
    configureUpdater(config);
    setupUpdaterEvents(event);
    const result = await updater.autoUpdater.checkForUpdates();
    const version = result?.updateInfo?.version ?? null;
    console.log('UPDATE CHECK ===>', result?.updateInfo);
    return { updateAvailable: version !== null, version };
  } catch (error: any) {
    Sentry.captureException(error, {
      tags: { source: 'auto-updater' },
      extra: { context: 'Electron auto-update process main' },
    });
    log.error('[AutoUpdater] Failed check and install updates:', error.message);
    throw error;
  }
}

export async function quitAndInstall() {
  try {
    updater.autoUpdater.quitAndInstall();
  } catch (error: any) {
    console.error('ERROR INSTALLING UPDATE', error);
    return error;
  }
}

export async function downloadUpdate(event: Electron.IpcMainInvokeEvent) {
  try {
    setupUpdaterEvents(event);
    configureUpdater({ autoDownload: true });
    return await updater.autoUpdater.downloadUpdate();
  } catch (error: any) {
    log.error('[AutoUpdater] Error downloading update:', error);
    throw error;
  }
}
