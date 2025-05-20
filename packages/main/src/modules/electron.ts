import path from 'path';
import fs from 'fs/promises';
import { app, BrowserWindow, clipboard, dialog, type OpenDialogOptions, shell } from 'electron';
import updater from 'electron-updater';
import { downloadedVersion } from '..';

export function getHome() {
  return app.getPath('home');
}

export function getUserDataPath() {
  return app.getPath('userData');
}

export function getAppHomeLegacy() {
  return path.join(getHome(), '.decentraland');
}

export async function getWorkspaceConfigPath(_path: string) {
  const editorHomePath = path.join(_path, '.editor');
  try {
    await fs.stat(_path);
  } catch (error) {
    await fs.mkdir(editorHomePath, { recursive: true });
  }
  return editorHomePath;
}

export async function showOpenDialog(opts: Partial<OpenDialogOptions>): Promise<string[]> {
  const window = BrowserWindow.getFocusedWindow();
  if (!window) return [];

  const { filePaths } = await dialog.showOpenDialog(window, opts);
  return filePaths;
}

export async function openExternal(url: string) {
  shell.openExternal(url);
}

export async function getAppVersion() {
  return app.getVersion();
}

export async function copyToClipboard(text: string) {
  clipboard.writeText(text);
}

export async function getDownloadedVersion() {
  return downloadedVersion;
}

export async function getUpdateInfo() {
  try {
    //TODO: remove before release & update URL
    updater.autoUpdater.forceDevUpdateConfig = true;
    updater.autoUpdater.autoDownload = false;
    updater.autoUpdater.fullChangelog = true;
    updater.autoUpdater.setFeedURL(
      'https://github.com/decentraland/creator-hub/releases/download/0.14.2',
    );
    const result = await updater.autoUpdater.checkForUpdates();
    const version = result?.updateInfo?.version ?? null;
    console.log('NEW VERSION DETECTED ===>', result);
    return { updateAvailable: version !== null, version };
  } catch (error: any) {
    return { updateAvailable: false, error: error.message, version: null };
  }
}
