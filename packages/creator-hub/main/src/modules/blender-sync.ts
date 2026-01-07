import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, mkdir, rm, copyFile, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import log from 'electron-log';
import * as blenderDetector from './blender-detector';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const execAsync = promisify(exec);

/**
 * Blender object metadata from export
 */
export interface BlenderObjectData {
  name: string;
  type: string;
  gltfFile?: string;
  location: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  scale: { x: number; y: number; z: number };
  dimensions: { x: number; y: number; z: number };
  parent: string | null;
  isCollider?: boolean;
  collection: string | null;
  visible: boolean;
}

/**
 * Blender export metadata
 */
export interface BlenderExportMetadata {
  objects: { [name: string]: BlenderObjectData };
  collections: { [name: string]: { name: string; objects: string[] } };
  coordinate_system: string;
  blender_version: string;
}

/**
 * Options for exporting from Blender
 */
export interface BlenderExportOptions {
  blendFilePath: string;
  blenderPath?: string;
  outputDir?: string;
}

/**
 * Result of Blender export
 */
export interface BlenderExportResult {
  success: boolean;
  gltfPath?: string;
  metadata?: BlenderExportMetadata;
  error?: string;
  outputDir?: string;
}

/**
 * Transform change detected between Blender and Decentraland
 */
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

/**
 * Scene sync data
 */
export interface SceneSyncData {
  changes: TransformChange[];
  gltfPath: string;
  metadata: BlenderExportMetadata;
}

/**
 * Entity data from Decentraland scene
 */
export interface EntityData {
  entityId: number;
  name?: string;
  gltfSrc?: string;
  transform?: {
    position?: { x: number; y: number; z: number };
    rotation?: { x: number; y: number; z: number; w: number };
    scale?: { x: number; y: number; z: number };
  };
}

/**
 * Export GLTF and metadata from Blender
 */
export async function exportFromBlender(
  options: BlenderExportOptions,
): Promise<BlenderExportResult> {
  log.info('[Blender Sync] Starting Blender export...');

  try {
    // Validate blend file exists
    if (!existsSync(options.blendFilePath)) {
      return {
        success: false,
        error: `Blend file not found: ${options.blendFilePath}`,
      };
    }

    // Get Blender path
    let blenderPath = options.blenderPath;
    if (!blenderPath) {
      const blenderInfo = await blenderDetector.detectBlender();
      if (!blenderInfo) {
        return {
          success: false,
          error: 'Blender not found. Please install Blender or set a custom path.',
        };
      }
      blenderPath = blenderInfo.path;
    }

    log.info('[Blender Sync] Using Blender:', blenderPath);

    // Create temporary output directory
    const outputDir =
      options.outputDir || join(tmpdir(), `blender-export-${Date.now()}`);
    await mkdir(outputDir, { recursive: true });

    log.info('[Blender Sync] Output directory:', outputDir);

    // Get the Python script path
    const scriptPath = join(__dirname, '..', 'resources', 'blender_export.py');
    
    if (!existsSync(scriptPath)) {
      return {
        success: false,
        error: `Export script not found: ${scriptPath}`,
      };
    }

    log.info('[Blender Sync] Export script:', scriptPath);

    // Run Blender in background mode
    const command = `"${blenderPath}" --background "${options.blendFilePath}" --python "${scriptPath}" -- "${outputDir}"`;
    
    log.info('[Blender Sync] Running command:', command);

    let stdout: string, stderr: string;
    try {
      const result = await execAsync(command, {
        timeout: 60000, // 60 second timeout
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (execError: any) {
      log.error('[Blender Sync] Blender execution failed:', execError);
      log.error('[Blender Sync] stdout:', execError.stdout);
      log.error('[Blender Sync] stderr:', execError.stderr);
      
      return {
        success: false,
        error: `Blender execution failed: ${execError.message}\n\nOutput: ${execError.stderr || execError.stdout || 'No output'}`,
      };
    }

    log.info('[Blender Sync] Blender stdout:', stdout);
    if (stderr) {
      log.warn('[Blender Sync] Blender stderr:', stderr);
    }

    // Check if export was successful (only need metadata, individual GLTFs are validated per-object)
    const metadataPath = join(outputDir, 'metadata.json');

    if (!existsSync(metadataPath)) {
      return {
        success: false,
        error: 'Export failed: metadata file not created',
      };
    }

    // Read metadata
    const metadataContent = await readFile(metadataPath, 'utf-8');
    const metadata: BlenderExportMetadata = JSON.parse(metadataContent);

    log.info('[Blender Sync] Export successful!');
    log.info('[Blender Sync] Exported', Object.keys(metadata.objects).length, 'objects');

    // Validate that individual GLTF files exist for each object
    let missingFiles: string[] = [];
    for (const [objectName, objectData] of Object.entries(metadata.objects)) {
      if (objectData.gltfFile) {
        const gltfFilePath = join(outputDir, objectData.gltfFile);
        if (!existsSync(gltfFilePath)) {
          missingFiles.push(objectData.gltfFile);
        }
      }
    }

    if (missingFiles.length > 0) {
      log.warn('[Blender Sync] Warning: Some GLTF files were not created:', missingFiles);
    }

    return {
      success: true,
      gltfPath: outputDir, // Return output directory path instead of single GLTF
      metadata,
      outputDir,
    };
  } catch (error: any) {
    log.error('[Blender Sync] Export failed:', error);
    return {
      success: false,
      error: error.message || 'Unknown error during export',
    };
  }
}

/**
 * Compare Blender objects with Decentraland entities and detect changes
 */
export function detectChanges(
  blenderObjects: { [name: string]: BlenderObjectData },
  entities: EntityData[],
): TransformChange[] {
  log.info('[Blender Sync] Detecting changes...');
  log.info('[Blender Sync] Blender objects:', Object.keys(blenderObjects).length, Object.keys(blenderObjects));
  log.info('[Blender Sync] Scene entities:', entities.length, entities.map(e => ({ name: e.name, entityId: e.entityId })));
  
  const changes: TransformChange[] = [];
  const entityMapByName = new Map<string, EntityData>();
  const entityMapByGltf = new Map<string, EntityData>(); // Map by GLTF filename for fallback matching
  const blenderObjectNames = new Set<string>(Object.keys(blenderObjects));

  // Build entity maps by name and by GLTF source
  for (const entity of entities) {
    if (entity.name) {
      entityMapByName.set(entity.name, entity);
      log.info(`[Blender Sync] Mapped entity by name: "${entity.name}" (ID: ${entity.entityId})`);
    }
    
    // Also map by GLTF filename for fallback matching
    if (entity.gltfSrc) {
      // Extract filename from path (e.g., "assets/blender/ObjectName.glb" -> "ObjectName.glb")
      const gltfFilename = entity.gltfSrc.split('/').pop() || '';
      if (gltfFilename) {
        entityMapByGltf.set(gltfFilename, entity);
        log.info(`[Blender Sync] Mapped entity by GLTF: "${gltfFilename}" -> "${entity.name || 'unnamed'}" (ID: ${entity.entityId})`);
      }
    }
    
    if (!entity.name && !entity.gltfSrc) {
      log.warn(`[Blender Sync] Entity without name or GLTF (ID: ${entity.entityId}) - will not be matched`);
    }
  }

  log.info('[Blender Sync] Entity maps:', {
    byName: entityMapByName.size,
    byGltf: entityMapByGltf.size,
  });

  // Check each Blender object (new objects and updates)
  for (const [objectName, blenderObj] of Object.entries(blenderObjects)) {
    // Try to match by name first
    let entity = entityMapByName.get(objectName);
    
    // If no match by name, try matching by GLTF filename
    if (!entity && blenderObj.gltfFile) {
      entity = entityMapByGltf.get(blenderObj.gltfFile);
      if (entity) {
        log.info(`[Blender Sync] Matched "${objectName}" by GLTF filename "${blenderObj.gltfFile}" to entity "${entity.name || 'unnamed'}" (ID: ${entity.entityId})`);
      }
    }

    if (entity) {
      log.info(`[Blender Sync] Found existing entity for "${objectName}" (ID: ${entity.entityId}, name: "${entity.name}")`);
    } else {
      log.info(`[Blender Sync] No existing entity found for "${objectName}" - will be created`);
    }

    const change: TransformChange = {
      objectName,
      gltfFile: blenderObj.gltfFile,
      entityId: entity?.entityId,
      entityName: entity?.name,
      newTransform: {
        position: blenderObj.location,
        rotation: blenderObj.rotation,
        scale: blenderObj.scale,
      },
      isNewObject: !entity,
      isDeleted: false,
    };

    log.info(`[Blender Sync] Object "${objectName}" transform from Blender:`, {
      position: blenderObj.location,
      rotation: blenderObj.rotation,
      scale: blenderObj.scale,
    });

    if (entity?.transform) {
      change.currentTransform = {
        position: entity.transform.position,
        rotation: entity.transform.rotation,
        scale: entity.transform.scale,
      };

      // Check if transforms are different
      const hasChanged = !areTransformsEqual(
        entity.transform,
        blenderObj,
      );

      // Check if GLTF changed
      const gltfChanged = blenderObj.gltfFile && entity.gltfSrc !== `assets/blender/${blenderObj.gltfFile}`;

      log.info(`[Blender Sync] Object "${objectName}": transformChanged=${hasChanged}, gltfChanged=${gltfChanged}`);

      // Only add to changes if transform actually changed or GLTF changed
      if (hasChanged || gltfChanged) {
        changes.push(change);
        log.info(`[Blender Sync] Added "${objectName}" to changes (update)`);
      } else {
        log.info(`[Blender Sync] Skipped "${objectName}" - no changes detected`);
      }
    } else {
      // New object or entity without transform
      changes.push(change);
      log.info(`[Blender Sync] Added "${objectName}" to changes (${entity ? 'entity without transform' : 'new object'})`);
    }
  }

  // Detect deleted objects (entities that exist in hub but not in Blender)
  // Check both by name and by GLTF filename
  const matchedEntityIds = new Set<number>();
  for (const [objectName, blenderObj] of Object.entries(blenderObjects)) {
    const entityByName = entityMapByName.get(objectName);
    const entityByGltf = blenderObj.gltfFile ? entityMapByGltf.get(blenderObj.gltfFile) : null;
    const entity = entityByName || entityByGltf;
    if (entity) {
      matchedEntityIds.add(entity.entityId);
    }
  }

  for (const entity of entities) {
    // Skip if this entity was already matched to a Blender object
    if (matchedEntityIds.has(entity.entityId)) {
      continue;
    }

    // IMPORTANT: Skip the "Blender" parent entity - it's a special container created by the Creator Hub,
    // not a real Blender object. It should never be marked as "deleted" during sync.
    if (entity.name === 'Blender') {
      log.info('[Blender Sync] Skipping "Blender" parent entity from deletion check (special container)');
      continue;
    }

    // Check if entity should be deleted (exists in scene but not in Blender)
    const shouldDelete = 
      (entity.name && !blenderObjectNames.has(entity.name)) ||
      (entity.gltfSrc && entity.gltfSrc.includes('assets/blender/') && 
       !Object.values(blenderObjects).some(obj => 
         obj.gltfFile && entity.gltfSrc?.endsWith(obj.gltfFile)
       ));

    if (shouldDelete) {
      const change: TransformChange = {
        objectName: entity.name || entity.gltfSrc?.split('/').pop()?.replace(/\.(glb|gltf)$/i, '') || 'Unknown',
        entityId: entity.entityId,
        entityName: entity.name,
        currentTransform: entity.transform,
        isNewObject: false,
        isDeleted: true,
      };
      changes.push(change);
      log.info(`[Blender Sync] Detected deleted object: ${entity.name || entity.gltfSrc} (ID: ${entity.entityId})`);
    }
  }

  log.info('[Blender Sync] Found', changes.length, 'changes', {
    new: changes.filter(c => c.isNewObject).length,
    updated: changes.filter(c => !c.isNewObject && !c.isDeleted).length,
    deleted: changes.filter(c => c.isDeleted).length,
  });
  return changes;
}

/**
 * Check if two transforms are equal (with small tolerance for floating point)
 */
function areTransformsEqual(
  transform1: {
    position?: { x: number; y: number; z: number };
    rotation?: { x: number; y: number; z: number; w: number };
    scale?: { x: number; y: number; z: number };
  },
  transform2: {
    location: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number; w: number };
    scale: { x: number; y: number; z: number };
  },
): boolean {
  const EPSILON = 0.0001;

  // Compare position
  if (transform1.position) {
    if (
      Math.abs(transform1.position.x - transform2.location.x) > EPSILON ||
      Math.abs(transform1.position.y - transform2.location.y) > EPSILON ||
      Math.abs(transform1.position.z - transform2.location.z) > EPSILON
    ) {
      return false;
    }
  }

  // Compare rotation
  if (transform1.rotation) {
    if (
      Math.abs(transform1.rotation.x - transform2.rotation.x) > EPSILON ||
      Math.abs(transform1.rotation.y - transform2.rotation.y) > EPSILON ||
      Math.abs(transform1.rotation.z - transform2.rotation.z) > EPSILON ||
      Math.abs(transform1.rotation.w - transform2.rotation.w) > EPSILON
    ) {
      return false;
    }
  }

  // Compare scale
  if (transform1.scale) {
    if (
      Math.abs(transform1.scale.x - transform2.scale.x) > EPSILON ||
      Math.abs(transform1.scale.y - transform2.scale.y) > EPSILON ||
      Math.abs(transform1.scale.z - transform2.scale.z) > EPSILON
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Delete all files in the assets/blender directory
 */
export async function cleanBlenderAssets(projectPath: string): Promise<void> {
  try {
    const assetsDir = join(projectPath, 'assets', 'blender');
    
    // Check if directory exists
    if (!existsSync(assetsDir)) {
      log.info('[Blender Sync] assets/blender directory does not exist, nothing to clean');
      return;
    }

    // Read all files in the directory
    const files = await readdir(assetsDir);
    
    log.info(`[Blender Sync] Found ${files.length} files in assets/blender/ to delete`);

    // Delete all files
    let deletedCount = 0;
    for (const file of files) {
      try {
        const filePath = join(assetsDir, file);
        await rm(filePath, { recursive: true, force: true });
        deletedCount++;
        log.info(`[Blender Sync] Deleted: ${file}`);
      } catch (error: any) {
        log.warn(`[Blender Sync] Failed to delete ${file}:`, error.message);
      }
    }

    log.info(`[Blender Sync] Deleted ${deletedCount} files from assets/blender/`);
  } catch (error: any) {
    log.error('[Blender Sync] Error cleaning blender assets:', error);
    // Don't throw - continue even if cleanup fails
  }
}

/**
 * Copy all exported GLTF/GLB files from the export directory to project assets folder
 */
export async function copyGltfsToProject(
  exportDir: string,
  projectPath: string,
): Promise<void> {
  try {
    // FIRST: Clean all existing files in assets/blender/
    await cleanBlenderAssets(projectPath);

    // Create blender assets directory in project
    const assetsDir = join(projectPath, 'assets', 'blender');
    await mkdir(assetsDir, { recursive: true });

    // Read all files in the export directory
    const files = await readdir(exportDir);

    // Copy all GLTF/GLB files (excluding metadata.json)
    let copiedCount = 0;
    for (const file of files) {
      if (file.endsWith('.gltf') || file.endsWith('.glb') || file.endsWith('.bin')) {
        const sourcePath = join(exportDir, file);
        const destPath = join(assetsDir, file);
        await copyFile(sourcePath, destPath);
        copiedCount++;
        log.info(`[Blender Sync] Copied: ${file}`);
      }
    }

    log.info('[Blender Sync] Copied', copiedCount, 'GLTF/GLB files to project');
  } catch (error: any) {
    log.error('[Blender Sync] Error copying GLTFs to project:', error);
    throw new Error(`Failed to copy GLTFs to project: ${error.message}`);
  }
}

/**
 * Clean up temporary export files
 */
export async function cleanupExport(outputDir: string): Promise<void> {
  try {
    if (existsSync(outputDir)) {
      await rm(outputDir, { recursive: true, force: true });
      log.info('[Blender Sync] Cleaned up export directory:', outputDir);
    }
  } catch (error) {
    log.error('[Blender Sync] Error cleaning up export:', error);
  }
}

