export enum DEPENDENCY_UPDATE_STRATEGY {
  AUTO_UPDATE = 'auto_update',
  NOTIFY = 'notify',
  DO_NOTHING = 'do_nothing',
}

export const DEFAULT_DEPENDENCY_UPDATE_STRATEGY = DEPENDENCY_UPDATE_STRATEGY.NOTIFY;

export enum PREVIEW_CLIENT {
  // The Decentraland Desktop (Unity) client, launched via `decentraland://` deep-link.
  DESKTOP = 'desktop',
  // The Bevy web client, opened in the browser via `sdk-commands start --bevy-web`.
  BEVY_WEB = 'bevy_web',
}

export const DEFAULT_PREVIEW_CLIENT = PREVIEW_CLIENT.DESKTOP;

export type PreviewOptions = {
  debugger: boolean;
  skipAuthScreen: boolean;
  enableLandscapeTerrains: boolean;
  openNewInstance: boolean;
  multiInstance: boolean;
  showWarnings: boolean;
  client: PREVIEW_CLIENT;
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
