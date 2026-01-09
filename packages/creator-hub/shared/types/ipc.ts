import type { OpenDialogOptions } from 'electron';

import type { Outdated } from '/shared/types/npm';
import type { Events } from '/shared/types/analytics';
import type { DeployOptions } from '/shared/types/deploy';

import type { PreviewOptions, ReleaseNotes } from './settings';
import type { Config, EditorConfig } from './config';

export type IpcResult<T> = {
  success: true;
  value: T;
};
export type IpcError = {
  success: false;
  error: {
    message: string;
    name: string;
  };
};

export interface Ipc {
  'electron.getUserDataPath': () => string;
  'electron.getAppVersion': () => Promise<string>;
  'updater.getDownloadedVersion': () => string | null;
  'updater.setupUpdaterEvents': () => void;
  'updater.checkForUpdates': (config?: { autoDownload?: boolean }) => Promise<{
    updateAvailable: boolean;
    error?: any;
    version: string | null;
  }>;
  'updater.downloadProgress': (progress: number) => void;
  'updater.quitAndInstall': (version: string) => Promise<void>;
  'updater.getInstalledVersion': () => Promise<string | undefined>;
  'updater.deleteVersionFile': () => Promise<void>;
  'updater.downloadUpdate': () => Promise<any>;
  'updater.getReleaseNotes': (version: string) => Promise<ReleaseNotes | undefined>;
  'electron.getWorkspaceConfigPath': (path: string) => Promise<string>;
  'electron.showOpenDialog': (opts: Partial<OpenDialogOptions>) => Promise<string[]>;
  'electron.openExternal': (url: string) => Promise<void>;
  'electron.copyToClipboard': (text: string) => Promise<void>;
  'inspector.start': () => Promise<number>;
  'inspector.openSceneDebugger': (path: string) => Promise<string>;
  'inspector.attachSceneDebugger': (path: string, eventName: string) => Promise<boolean>;
  'config.getConfig': () => Promise<Config>;
  'config.writeConfig': (config: Config) => Promise<void>;
  'bin.install': () => Promise<void>;

  'code.open': (path: string) => Promise<void>;
  'code.getEditors': () => Promise<EditorConfig[]>;
  'code.addEditor': (path: string) => Promise<EditorConfig[]>;
  'code.setDefaultEditor': (path: string) => Promise<EditorConfig[]>;
  'code.removeEditor': (path: string) => Promise<EditorConfig[]>;

  'cli.init': (path: string, repo: string) => Promise<void>;
  'cli.start': (path: string, opts: PreviewOptions) => Promise<string>;
  'cli.deploy': (opts: DeployOptions) => Promise<number>;
  'cli.killPreview': (path: string) => Promise<void>;
  'analytics.track': <T extends keyof Events>(event: T, data?: Events[T]) => void;
  'analytics.identify': (userId: string, traits?: Record<string, any>) => void;
  'analytics.getAnonymousId': () => Promise<string>;
  'analytics.getProjectId': (path: string) => Promise<string>;
  'npm.install': (path: string, packages?: string[]) => Promise<void>;
  'npm.getOutdatedDeps': (path: string, packages?: string[]) => Promise<Outdated>;
  'npm.getContextFiles': (path: string) => Promise<void>;
  'scene.exportAsGltf': (data: SceneExportData) => Promise<ExportResult>;
  
  // Blender sync
  'blender.detect': () => Promise<BlenderInfo | null>;
  'blender.validatePath': (path: string) => Promise<BlenderInfo | null>;
  'blender.setCustomPath': (path: string) => Promise<boolean>;
  'blender.clearCustomPath': () => Promise<void>;
  'blender.exportFromBlend': (options: BlenderExportOptions) => Promise<BlenderExportResult>;
  'blender.detectChanges': (data: BlenderSyncCompareData) => Promise<BlenderSyncResult>;
}

export interface EntityData {
  entityId: number;
  gltfSrc?: string;
  transform?: {
    position?: { x: number; y: number; z: number };
    rotation?: { x: number; y: number; z: number; w: number };
    scale?: { x: number; y: number; z: number };
  };
  name?: string;
}

export interface SceneExportData {
  projectPath: string;
  entities: EntityData[];
}

export interface ExportResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

// Blender Types
export interface BlenderInfo {
  path: string;
  version: string;
  isValid: boolean;
}

export interface BlenderExportOptions {
  blendFilePath: string;
  blenderPath?: string;
  outputDir?: string;
}

export interface BlenderObjectData {
  name: string;
  type: string;
  location: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  scale: { x: number; y: number; z: number };
  dimensions: { x: number; y: number; z: number };
  parent: string | null;
  collection: string | null;
  visible: boolean;
}

export interface BlenderExportMetadata {
  objects: { [name: string]: BlenderObjectData };
  collections: { [name: string]: { name: string; objects: string[] } };
  coordinate_system: string;
  blender_version: string;
}

export interface BlenderExportResult {
  success: boolean;
  gltfPath?: string;
  metadata?: BlenderExportMetadata;
  error?: string;
  outputDir?: string;
}

export interface TransformChange {
  objectName: string;
  gltfFile?: string;
  entityId?: number;
  entityName?: string;
  currentTransform?: {
    position?: { x: number; y: number; z: number };
    rotation?: { x: number; y: number; z: number; w: number };
    scale?: { x: number; y: number; z: number };
  };
  newTransform?: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number; w: number };
    scale: { x: number; y: number; z: number };
  };
  isNewObject: boolean;
  isDeleted: boolean;
}

export interface BlenderSyncCompareData {
  blendFilePath: string;
  entities: EntityData[];
  blenderPath?: string;
  projectPath?: string;
}

export interface BlenderSyncResult {
  success: boolean;
  changes?: TransformChange[];
  gltfPath?: string;
  metadata?: BlenderExportMetadata;
  outputDir?: string;
  error?: string;
}
