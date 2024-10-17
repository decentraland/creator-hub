import {
  DEPENDENCY_UPDATE_STRATEGY,
  DEFAULT_DEPENDENCY_UPDATE_STRATEGY,
} from '/shared/types/settings';
import { invoke } from './invoke';
import { getConfig, setConfig } from './config';

export async function getScenesPath() {
  const config = await getConfig();
  return config.scenesPath ?? (await invoke('electron.getAppHome'));
}

export async function setScenesPath(path: string) {
  await setConfig(config => (config.scenesPath = path));
}

// Helper to check if a value is part of the enum
function isValidUpdateStrategy(value?: string): value is DEPENDENCY_UPDATE_STRATEGY {
  return Object.values(DEPENDENCY_UPDATE_STRATEGY).includes(value as DEPENDENCY_UPDATE_STRATEGY);
}

export async function getUpdateDependenciesStrategy() {
  const { updateDependenciesStrategy } = await getConfig();
  if (isValidUpdateStrategy(updateDependenciesStrategy)) return updateDependenciesStrategy;
  return DEFAULT_DEPENDENCY_UPDATE_STRATEGY;
}

export async function setUpdateDependenciesStrategy(strategy: DEPENDENCY_UPDATE_STRATEGY) {
  await setConfig(config => (config.updateDependenciesStrategy = strategy));
}

export async function selectSceneFolder(): Promise<string | undefined> {
  const [projectPath] = await invoke('electron.showOpenDialog', {
    title: 'Select Scenes Folder',
    properties: ['openDirectory'],
  });

  return projectPath;
}
