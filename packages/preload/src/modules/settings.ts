import {
  DEPENDENCY_UPDATE_STRATEGY,
  DEFAULT_DEPENDENCY_UPDATE_STRATEGY,
} from '/shared/types/settings';
import type { AppSettings } from '/shared/types/settings';

import { invoke } from './invoke';
import { getConfig, setConfig } from './config';

export function getDefaultScenesPath() {
  return invoke('electron.getAppHome');
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
