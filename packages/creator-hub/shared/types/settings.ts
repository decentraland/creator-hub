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

export enum RENDERER {
  // The built-in Babylon.js renderer (default).
  BABYLON = 'babylon',
  // The Bevy engine renderer. Editing runs against a headless sdk-commands realm
  // + the super-user editor-agent portable experience.
  BEVY = 'bevy',
}

export const DEFAULT_RENDERER = RENDERER.BABYLON;

export type AppSettings = {
  scenesPath: string;
  dependencyUpdateStrategy: DEPENDENCY_UPDATE_STRATEGY;
  previewOptions: PreviewOptions;
  // Which engine the inspector uses to render the scene in the editor viewport.
  renderer: RENDERER;
};

export interface ReleaseNotes {
  version: string;
  content: string;
}
