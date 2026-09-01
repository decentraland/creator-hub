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
  mcp: boolean;
  showWarnings: boolean;
  optimizedAssets: boolean;
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
  // Per-project Optimize Assets preference, keyed by project path. `previewOptions.optimizedAssets`
  // is the ephemeral value for the open project; this map is the persisted per-project source of
  // truth so the toggle comes back on for a project that had it on, without carrying across projects.
  optimizedAssetsByPath?: Record<string, boolean>;
  // Opt-in to experimental features. Gates the renderer picker in settings — off
  // means the stable default renderer (Babylon), no picker shown. Kept as its own
  // persisted flag (not derived from `renderer`) so the picker stays visible when
  // the user selects the default renderer from within experimental mode.
  experimental: boolean;
  // Which engine the inspector uses to render the scene in the editor viewport.
  renderer: RENDERER;
  guiEditor: boolean;
};

export interface ReleaseNotes {
  version: string;
  content: string;
}
