import { invoke } from '../services/ipc';
import type {
  BlenderInfo,
  BlenderExportOptions,
  BlenderExportResult,
  BlenderSyncCompareData,
  BlenderSyncResult,
} from '/shared/types/ipc';

/**
 * Detect Blender installation on the system
 */
export async function detectBlender(): Promise<BlenderInfo | null> {
  return invoke('blender.detect');
}

/**
 * Validate a Blender path and get version info
 */
export async function validateBlenderPath(path: string): Promise<BlenderInfo | null> {
  return invoke('blender.validatePath', path);
}

/**
 * Set custom Blender path
 */
export async function setCustomBlenderPath(path: string): Promise<boolean> {
  return invoke('blender.setCustomPath', path);
}

/**
 * Clear custom Blender path
 */
export async function clearCustomBlenderPath(): Promise<void> {
  return invoke('blender.clearCustomPath');
}

/**
 * Export from Blender
 */
export async function exportFromBlend(
  options: BlenderExportOptions,
): Promise<BlenderExportResult> {
  return invoke('blender.exportFromBlend', options);
}

/**
 * Detect changes between Blender and Decentraland scene
 */
export async function detectChanges(data: BlenderSyncCompareData): Promise<BlenderSyncResult> {
  return invoke('blender.detectChanges', data);
}

