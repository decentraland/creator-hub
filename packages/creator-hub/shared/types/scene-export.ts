export const SCENE_EXPORT_PROGRESS_EVENT = 'sceneExport.progress';

/** Where the scene is deployed: a catalyst peer (LAND) or a content server such as the Worlds one. */
export type SceneSource = { peerUrl: string } | { contentUrl: string };

export type SceneExportOptions = {
  entityId: string;
  outputPath: string;
} & SceneSource;

export type SceneExportProgress = {
  entityId: string;
  phase: 'download' | 'zip';
  done: number;
  total: number;
};

export type SceneExportResult = {
  files: number;
  bytes: number;
  recoveredSources: number;
  recovered: 'none' | 'self-contained' | 'partial';
  skipped: string[];
};
