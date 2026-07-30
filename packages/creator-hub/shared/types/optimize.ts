export type OptimizeOptions = {
  path: string;
  basecolorSize?: number;
  normalSize?: number;
  ormSize?: number;
  emissiveSize?: number;
  otherSize?: number;
  quality?: number;
  format?: string;
  dryRun?: boolean;
};

export type OptimizeFileResult = {
  path: string;
  originalSize: number;
  optimizedSize: number;
  skipped: boolean;
  reason?: string;
};

export type OptimizeResult = {
  glbsProcessed: number;
  texturesExtracted: number;
  compression: OptimizeFileResult[];
  summary: {
    filesProcessed: number;
    filesOptimized: number;
    totalSaved: number;
  };
};
