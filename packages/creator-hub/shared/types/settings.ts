export enum DEPENDENCY_UPDATE_STRATEGY {
  AUTO_UPDATE = 'auto_update',
  NOTIFY = 'notify',
  DO_NOTHING = 'do_nothing',
}

export const DEFAULT_DEPENDENCY_UPDATE_STRATEGY = DEPENDENCY_UPDATE_STRATEGY.NOTIFY;

export type PreviewOptions = {
  debugger: boolean;
  skipAuthScreen: boolean;
  enableLandscapeTerrains: boolean;
  openNewInstance: boolean;
  multiInstance: boolean;
  showWarnings: boolean;
  optimizedAssets: boolean;
};

export type AppSettings = {
  scenesPath: string;
  dependencyUpdateStrategy: DEPENDENCY_UPDATE_STRATEGY;
  previewOptions: PreviewOptions;
  // Per-project Optimize Assets preference, keyed by project path. `previewOptions.optimizedAssets`
  // is the ephemeral value for the open project; this map is the persisted per-project source of
  // truth so the toggle comes back on for a project that had it on, without carrying across projects.
  optimizedAssetsByPath?: Record<string, boolean>;
};

export interface ReleaseNotes {
  version: string;
  content: string;
}
