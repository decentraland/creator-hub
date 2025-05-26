import path from 'path';
import {
  DEPENDENCY_UPDATE_STRATEGY,
  DEFAULT_DEPENDENCY_UPDATE_STRATEGY,
} from '/shared/types/settings';
import type { AppSettings } from '/shared/types/settings';
import { SCENES_DIRECTORY } from '/shared/paths';

import { invoke } from '../services/ipc';
import { getConfig, setConfig } from '../services/config';
import { ipcRenderer, type IpcRendererEvent } from 'electron';

export async function getDefaultScenesPath() {
  const userDataPath = await invoke('electron.getUserDataPath');
  return path.join(userDataPath, SCENES_DIRECTORY);
}

export async function getScenesPath() {
  const config = await getConfig();
  return config.settings?.scenesPath ?? (await getDefaultScenesPath());
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
    properties: ['openDirectory'],
  });

  return projectPath;
}

export async function checkForUpdates(config?: { autoDownload?: boolean }) {
  return await invoke('updater.checkForUpdates', config);
}

export async function getDownloadedVersion() {
  return await invoke('updater.getDownloadedVersion');
}

export async function quitAndInstall() {
  return await invoke('updater.quitAndInstall');
}

export async function downloadUpdate() {
  return await invoke('updater.downloadUpdate');
}

export function downloadState(
  cb: (event: IpcRendererEvent, progress: { percent: number; finished: boolean }) => void,
) {
  ipcRenderer.on('updater.downloadProgress', cb);

  return {
    cleanup: () => {
      ipcRenderer.off('updater.downloadProgress', cb);
    },
  };
}
