import deepmerge from 'deepmerge';
import { type AppSettings } from './settings';
import {
  DEFAULT_DEPENDENCY_UPDATE_STRATEGY,
  DEFAULT_PREVIEW_CLIENT,
  DEFAULT_RENDERER,
} from './settings';

export const CURRENT_CONFIG_VERSION = 2;

export type EditorConfig = {
  name: string;
  path: string;
  isDefault?: boolean;
  hidden?: boolean;
};

export type Config = {
  version: number;
  workspace: {
    paths: string[];
  };
  settings: AppSettings;
  userId?: string;
  editors?: EditorConfig[];
  installedAt?: string;
  lastVersion?: string;
};

export const DEFAULT_CONFIG: Config = {
  version: CURRENT_CONFIG_VERSION,
  workspace: {
    paths: [],
  },
  settings: {
    scenesPath: '', // Will be set with userDataPath + SCENES_DIRECTORY by main/preload
    dependencyUpdateStrategy: DEFAULT_DEPENDENCY_UPDATE_STRATEGY,
    previewOptions: {
      debugger: false,
      skipAuthScreen: true,
      enableLandscapeTerrains: true,
      openNewInstance: false,
      multiInstance: false,
      mcp: false,
      showWarnings: true,
      optimizedAssets: false,
      client: DEFAULT_PREVIEW_CLIENT,
    },
    optimizedAssetsByPath: {},
    experimental: false,
    renderer: DEFAULT_RENDERER,
    aiAssistant: false,
    exposeMcpServer: false,
    useApiKeyFromEnv: false,
    guiEditor: false,
  },
  editors: [],
};

export function mergeConfig(target: Partial<Config>, source: Config): Config {
  return deepmerge(source, target, {
    customMerge: key => {
      if (key === 'scenesPath') {
        // Avoid overwriting scenesPath with empty string, use default (sourcePath) instead.
        return (targetPath: string, sourcePath: string) => targetPath || sourcePath;
      }
    },
    // Clone arrays instead of merging them
    arrayMerge: (_, sourceArray) => sourceArray,
  });
}
