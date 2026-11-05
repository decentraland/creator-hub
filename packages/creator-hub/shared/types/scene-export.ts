export const SCENE_EXPORT_PROGRESS_EVENT = 'sceneExport.progress';

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
