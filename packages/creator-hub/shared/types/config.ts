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
    showScenesTutorials: true,
    previewOptions: {
      debugger: true,
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
    aiAssistant: true,
    exposeMcpServer: false,
    useApiKeyFromEnv: false,
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
    arrayMerge: (_, sourceArray) => sourceArray,
  });
}

export function dropGuiEditorSetting(settings: Partial<AppSettings> | undefined): void {
  if (settings) {
    delete (settings as Record<string, unknown>).guiEditor;
  }
}

/** Enables the AI assistant once, in place, on merged settings not yet promoted. */
export function promoteAiAssistantSetting(settings: Partial<AppSettings> | undefined): void {
  if (settings && !settings.aiAssistantPromoted) {
    settings.aiAssistant = true;
    settings.aiAssistantPromoted = true;
  }
}

/** Enables the debug console once, in place, on merged settings not yet promoted — the
 * toolbar's "Open Debug Console" checkbox was removed, so this is now the only way an
 * existing install gets it turned on. */
export function promoteDebugConsoleSetting(settings: Partial<AppSettings> | undefined): void {
  if (settings && settings.previewOptions && !settings.debugConsolePromoted) {
    settings.previewOptions.debugger = true;
    settings.debugConsolePromoted = true;
  }
}
