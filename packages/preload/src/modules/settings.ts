import path from 'path';
import {
  DEPENDENCY_UPDATE_STRATEGY,
  DEFAULT_DEPENDENCY_UPDATE_STRATEGY,
} from '/shared/types/settings';
import type { AppSettings } from '/shared/types/settings';
import { SCENES_DIRECTORY } from '/shared/paths';

import { invoke } from '../services/ipc';
import { getConfig, setConfig } from '../services/config';

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

export async function getUpdateInfo() {
  return await invoke('electron.getUpdateInfo');
}

export async function getDownloadedVersion() {
  return await invoke('electron.getDownloadedVersion');
}

export async function quitAndInstall() {
  return await invoke('electron.quitAndInstall');
}

export async function installUpdate() {
  return await invoke('electron.installUpdate');
}
