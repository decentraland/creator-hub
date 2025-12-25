import path from 'path';
import { ipcRenderer, type IpcRendererEvent } from 'electron';
import {
  DEPENDENCY_UPDATE_STRATEGY,
  DEFAULT_DEPENDENCY_UPDATE_STRATEGY,
} from '/shared/types/settings';
import type { AppSettings, ReleaseNotes } from '/shared/types/settings';
import { SCENES_DIRECTORY } from '/shared/paths';

import { invoke } from '../services/ipc';
import { getConfig, setConfig } from '../services/config';
import { GITHUB_RELEASES_API } from './constants';

export async function getDefaultScenesPath() {
  const userDataPath = await invoke('electron.getUserDataPath');
  return path.join(userDataPath, SCENES_DIRECTORY);
}

export async function getScenesPath() {
  const config = await getConfig();
  return config.settings?.scenesPath || (await getDefaultScenesPath());
}

export async function isCustomScenesPath(currentPath: string): Promise<boolean> {
  const defaultPath = await getDefaultScenesPath();
  return currentPath !== defaultPath;
}

export function isValidUpdateStrategy(value?: string): value is DEPENDENCY_UPDATE_STRATEGY {
  return Object.values(DEPENDENCY_UPDATE_STRATEGY).includes(value as DEPENDENCY_UPDATE_STRATEGY);
}

export async function getUpdateDependenciesStrategy() {
  const { dependencyUpdateStrategy } = (await getConfig()).settings;
  if (isValidUpdateStrategy(dependencyUpdateStrategy)) return dependencyUpdateStrategy;
  return DEFAULT_DEPENDENCY_UPDATE_STRATEGY;
}

export async function updateAppSettings(settings: AppSettings) {
  // update app settings on config file
  await setConfig(config => (config.settings = settings));
}

export async function selectSceneFolder(): Promise<string | undefined> {
  const [projectPath] = await invoke('electron.showOpenDialog', {
    title: 'Select Scenes Folder',
    properties: ['openDirectory', 'createDirectory', 'promptToCreate'],
  });

  return projectPath;
}

export async function selectEditorPath(): Promise<string[]> {
  return invoke('electron.showOpenDialog', {
    title: 'Select Code Editor',
    properties: ['openFile'],
  });
}

export async function checkForUpdates(config?: { autoDownload?: boolean }) {
  return await invoke('updater.checkForUpdates', config);
}

export async function getDownloadedVersion() {
  return await invoke('updater.getDownloadedVersion');
}

export async function quitAndInstall(version: string) {
  return await invoke('updater.quitAndInstall', version);
}

export async function downloadUpdate() {
  return await invoke('updater.downloadUpdate');
}

export async function setupUpdaterEvents() {
  return await invoke('updater.setupUpdaterEvents');
}

export async function getInstalledVersion() {
  return await invoke('updater.getInstalledVersion');
}

export async function deleteVersionFile() {
  return await invoke('updater.deleteVersionFile');
}

export function downloadingStatus(
  cb: (
    event: IpcRendererEvent,
    progress: {
      percent: number;
      finished: boolean;
      version: string | null;
      isDownloading: boolean;
      error?: string;
    },
  ) => void,
) {
  ipcRenderer.on('updater.downloadProgress', cb);
  return {
    cleanup: () => {
      ipcRenderer.off('updater.downloadProgress', cb);
    },
  };
}
export function getCurrentVersion() {
  throw new Error('Function not implemented.');
}

export async function getEditors() {
  return invoke('code.getEditors');
}

export async function addEditor(editorPath: string) {
  return await invoke('code.addEditor', editorPath);
}

export async function setDefaultEditor(editorPath: string) {
  return await invoke('code.setDefaultEditor', editorPath);
}

export async function removeEditor(editorPath: string) {
  return await invoke('code.removeEditor', editorPath);
}

/**
 * Parses the GitHub release markdown body to extract features and bug fixes.
 * Features are lines starting with "* feat:" and fixes are lines starting with "* fix:"
 */
function parseReleaseBody(body: string): { whatsNew: string[]; bugFixes: string[] } {
  const whatsNew: string[] = [];
  const bugFixes: string[] = [];

  const lines = body.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Match lines like "* feat: description by @user in #123"
    const featMatch = trimmedLine.match(
      /^\*\s*feat:\s*(.+?)(?:\s+by\s+@[\w-]+)?(?:\s+in\s+#\d+)?$/i,
    );
    if (featMatch) {
      whatsNew.push(featMatch[1].trim());
      continue;
    }

    // Match lines like "* fix: description by @user in #123"
    const fixMatch = trimmedLine.match(/^\*\s*fix:\s*(.+?)(?:\s+by\s+@[\w-]+)?(?:\s+in\s+#\d+)?$/i);
    if (fixMatch) {
      bugFixes.push(fixMatch[1].trim());
      continue;
    }
  }

  return { whatsNew, bugFixes };
}

/**
 * Fetches release notes from GitHub API for a specific version.
 * @param version - The version tag to fetch (e.g., "0.31.0")
 * @returns ReleaseNotes object with parsed features and bug fixes
 */
export async function getReleaseNotes(version: string): Promise<ReleaseNotes> {
  try {
    const response = await fetch(`${GITHUB_RELEASES_API}/${version}`);

    if (!response.ok) {
      console.warn(
        `[Preload] Failed to fetch release notes for version ${version}:`,
        response.status,
      );
      return { version, whatsNew: [], bugFixes: [] };
    }

    const release = await response.json();
    const body = release.body || '';
    const { whatsNew, bugFixes } = parseReleaseBody(body);

    return { version, whatsNew, bugFixes };
  } catch (error) {
    console.warn('[Preload] Could not fetch release notes:', error);
    return { version, whatsNew: [], bugFixes: [] };
  }
}
