export enum DEPENDENCY_UPDATE_STRATEGY {
  AUTO_UPDATE = 'auto_update',
  NOTIFY = 'notify',
  DO_NOTHING = 'do_nothing',
}

export const DEFAULT_DEPENDENCY_UPDATE_STRATEGY = DEPENDENCY_UPDATE_STRATEGY.NOTIFY;

export const MIN_MULTI_INSTANCE_SDK_COMMANDS_VERSION = '7.20.4';

export type PreviewOptions = {
  debugger: boolean;
  skipAuthScreen: boolean;
  enableLandscapeTerrains: boolean;
  openNewInstance: boolean;
  multiInstance: boolean;
  showWarnings: boolean;
};

export type AppSettings = {
  scenesPath: string;
  dependencyUpdateStrategy: DEPENDENCY_UPDATE_STRATEGY;
  previewOptions: PreviewOptions;
};

export interface ReleaseNotes {
  version: string;
  content: string;
}
