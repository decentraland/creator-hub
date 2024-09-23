import { UPDATE_DEPENDENCIES_STRATEGY } from '/shared/types/settings';
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
function isValidUpdateStrategy(value: string): value is UPDATE_DEPENDENCIES_STRATEGY {
  return Object.values(UPDATE_DEPENDENCIES_STRATEGY).includes(
    value as UPDATE_DEPENDENCIES_STRATEGY,
  );
}

export async function getUpdateDependenciesStrategy() {
  const config = await getConfig();
  if (
    config.updateDependenciesStrategy &&
    isValidUpdateStrategy(config.updateDependenciesStrategy)
  ) {
    return config.updateDependenciesStrategy;
  } else {
    return UPDATE_DEPENDENCIES_STRATEGY.NOTIFY;
  }
}

export async function setUpdateDependenciesStrategy(strategy: UPDATE_DEPENDENCIES_STRATEGY) {
  await setConfig(config => (config.updateDependenciesStrategy = strategy));
}

export async function selectSceneFolder(): Promise<string | undefined> {
  const [projectPath] = await invoke('electron.showOpenDialog', {
    title: 'Select Scenes Folder',
    properties: ['openDirectory'],
  });

  return projectPath;
}
