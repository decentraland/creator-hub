import { dialog } from 'electron';
import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import log from 'electron-log';
import { Document, NodeIO } from '@gltf-transform/core';
import { dedup, prune, resample, weld } from '@gltf-transform/functions';

/**
 * Entity data from the ECS system
 */
export interface EntityData {
  entityId: number;
  gltfSrc?: string; // Path to GLTF file (relative to project root)
  transform?: {
    position?: { x: number; y: number; z: number };
    rotation?: { x: number; y: number; z: number; w: number };
    scale?: { x: number; y: number; z: number };
  };
  name?: string;
}

/**
 * Scene export data
 */
export interface SceneExportData {
  projectPath: string;
  entities: EntityData[];
}

/**
 * Result of export operation
 */
export interface ExportResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

/**
 * Export a Decentraland scene as a single merged GLTF file
 */
export async function exportSceneAsGltf(data: SceneExportData): Promise<ExportResult> {
  try {
    log.info('[GLTF Export] Starting export for', data.projectPath);
    log.info('[GLTF Export] Found', data.entities.length, 'entities');

    // Filter entities that have GLTF containers
    const gltfEntities = data.entities.filter(entity => entity.gltfSrc);
    log.info('[GLTF Export] Found', gltfEntities.length, 'entities with GLTF models');

    if (gltfEntities.length === 0) {
      return {
        success: false,
        error: 'No GLTF models found in the scene. Add some 3D models before exporting.',
      };
    }

    // Show save dialog
    const result = await dialog.showSaveDialog({
      title: 'Export Scene as GLTF',
      defaultPath: 'scene-export.glb',
      filters: [
        { name: 'GLTF Binary', extensions: ['glb'] },
        { name: 'GLTF JSON', extensions: ['gltf'] },
      ],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, error: 'Export canceled by user' };
    }

    const outputPath = result.filePath;
    const io = new NodeIO();

    // Create a new GLTF document
    const mergedDoc = new Document();
    const mergedScene = mergedDoc.createScene('MergedScene');
    const mergedBuffer = mergedDoc.createBuffer();

    // Track loaded models to avoid duplicates
    const loadedModels = new Map<string, Document>();

    // Process each entity
    for (const entity of gltfEntities) {
      try {
        if (!entity.gltfSrc) continue;

        const gltfPath = join(data.projectPath, entity.gltfSrc);
        log.info('[GLTF Export] Loading model:', gltfPath);

        // Load or reuse already loaded model
        let sourceDoc: Document;
        if (loadedModels.has(entity.gltfSrc)) {
          // Clone the loaded document for reuse
          const originalDoc = loadedModels.get(entity.gltfSrc)!;
          sourceDoc = originalDoc.clone ? originalDoc.clone() : originalDoc;
        } else {
          try {
            const gltfData = await readFile(gltfPath);
            sourceDoc = await io.readBinary(gltfData);
            loadedModels.set(entity.gltfSrc, sourceDoc);
          } catch (error) {
            log.warn('[GLTF Export] Failed to load model:', gltfPath, error);
            continue;
          }
        }

        // Get the root node(s) from the source document
        const sourceScene = sourceDoc.getRoot().listScenes()[0];
        if (!sourceScene) continue;

        const sourceNodes = sourceScene.listChildren();
        if (sourceNodes.length === 0) continue;

        // Create a parent node for this entity
        const entityNode = mergedDoc.createNode(entity.name || `Entity_${entity.entityId}`);

        // Apply transform from Decentraland entity
        if (entity.transform) {
          const { position, rotation, scale } = entity.transform;

          if (position) {
            // Decentraland uses Y-up coordinate system
            entityNode.setTranslation([position.x, position.y, position.z]);
          }

          if (rotation) {
            // Decentraland uses quaternions (x, y, z, w)
            entityNode.setRotation([rotation.x, rotation.y, rotation.z, rotation.w]);
          }

          if (scale) {
            entityNode.setScale([scale.x, scale.y, scale.z]);
          }
        }

        // Copy nodes from source to merged document
        for (const sourceNode of sourceNodes) {
          const clonedNode = cloneNodeHierarchy(sourceNode, mergedDoc, mergedBuffer);
          if (clonedNode) {
            entityNode.addChild(clonedNode);
          }
        }

        mergedScene.addChild(entityNode);
      } catch (error) {
        log.error('[GLTF Export] Error processing entity:', entity.entityId, error);
      }
    }

    // Optimize the merged document
    log.info('[GLTF Export] Optimizing merged model...');
    await mergedDoc.transform(
      // Remove duplicate data
      dedup(),
      // Remove unused nodes, meshes, etc.
      prune(),
      // Weld duplicate vertices
      weld(),
      // Resample animations (if any)
      resample(),
    );

    // Write the merged GLTF file
    log.info('[GLTF Export] Writing to:', outputPath);
    const extension = outputPath.toLowerCase().endsWith('.gltf') ? '.gltf' : '.glb';

    if (extension === '.glb') {
      const glbData = await io.writeBinary(mergedDoc);
      await writeFile(outputPath, glbData);
    } else {
      const { json, resources } = await io.writeJSON(mergedDoc, { basename: 'scene-export' });
      await writeFile(outputPath, JSON.stringify(json, null, 2));

      // Write additional resources (bin, textures)
      for (const [uri, data] of Object.entries(resources)) {
        const resourcePath = join(dirname(outputPath), uri);
        await writeFile(resourcePath, data);
      }
    }

    log.info('[GLTF Export] Export completed successfully');
    return {
      success: true,
      filePath: outputPath,
    };
  } catch (error: any) {
    log.error('[GLTF Export] Export failed:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred during export',
    };
  }
}

/**
 * Clone a node and its entire hierarchy to a new document
 */
function cloneNodeHierarchy(
  sourceNode: any,
  targetDoc: Document,
  targetBuffer: any,
): any | null {
  try {
    const targetNode = targetDoc.createNode(sourceNode.getName() || '');

    // Copy transform
    const translation = sourceNode.getTranslation();
    const rotation = sourceNode.getRotation();
    const scale = sourceNode.getScale();

    if (translation) targetNode.setTranslation(translation);
    if (rotation) targetNode.setRotation(rotation);
    if (scale) targetNode.setScale(scale);

    // Copy mesh if present
    const sourceMesh = sourceNode.getMesh();
    if (sourceMesh) {
      const targetMesh = cloneMesh(sourceMesh, targetDoc, targetBuffer);
      if (targetMesh) {
        targetNode.setMesh(targetMesh);
      }
    }

    // Copy skin if present
    const sourceSkin = sourceNode.getSkin();
    if (sourceSkin) {
      // Note: Skin cloning is complex and may need special handling
      log.warn('[GLTF Export] Skipping skin on node:', sourceNode.getName());
    }

    // Recursively clone children
    for (const child of sourceNode.listChildren()) {
      const clonedChild = cloneNodeHierarchy(child, targetDoc, targetBuffer);
      if (clonedChild) {
        targetNode.addChild(clonedChild);
      }
    }

    return targetNode;
  } catch (error) {
    log.error('[GLTF Export] Error cloning node:', error);
    return null;
  }
}

/**
 * Clone a mesh to a new document
 */
function cloneMesh(sourceMesh: any, targetDoc: Document, targetBuffer: any): any | null {
  try {
    const targetMesh = targetDoc.createMesh(sourceMesh.getName() || '');

    // Clone each primitive
    for (const sourcePrimitive of sourceMesh.listPrimitives()) {
      const targetPrimitive = targetDoc.createPrimitive();

      // Copy mode (POINTS, LINES, TRIANGLES, etc.)
      targetPrimitive.setMode(sourcePrimitive.getMode());

      // Copy attributes (POSITION, NORMAL, TEXCOORD_0, etc.)
      for (const semantic of sourcePrimitive.listSemantics()) {
        const sourceAttribute = sourcePrimitive.getAttribute(semantic);
        if (sourceAttribute) {
          const targetAttribute = cloneAccessor(sourceAttribute, targetDoc, targetBuffer);
          if (targetAttribute) {
            targetPrimitive.setAttribute(semantic, targetAttribute);
          }
        }
      }

      // Copy indices
      const sourceIndices = sourcePrimitive.getIndices();
      if (sourceIndices) {
        const targetIndices = cloneAccessor(sourceIndices, targetDoc, targetBuffer);
        if (targetIndices) {
          targetPrimitive.setIndices(targetIndices);
        }
      }

      // Copy material
      const sourceMaterial = sourcePrimitive.getMaterial();
      if (sourceMaterial) {
        const targetMaterial = cloneMaterial(sourceMaterial, targetDoc, targetBuffer);
        if (targetMaterial) {
          targetPrimitive.setMaterial(targetMaterial);
        }
      }

      targetMesh.addPrimitive(targetPrimitive);
    }

    return targetMesh;
  } catch (error) {
    log.error('[GLTF Export] Error cloning mesh:', error);
    return null;
  }
}

/**
 * Clone an accessor (vertex data) to a new document
 */
function cloneAccessor(sourceAccessor: any, targetDoc: Document, targetBuffer: any): any | null {
  try {
    const targetAccessor = targetDoc.createAccessor(sourceAccessor.getName() || '');

    targetAccessor.setType(sourceAccessor.getType());
    targetAccessor.setArray(sourceAccessor.getArray()!);
    targetAccessor.setBuffer(targetBuffer);
    targetAccessor.setNormalized(sourceAccessor.getNormalized());

    return targetAccessor;
  } catch (error) {
    log.error('[GLTF Export] Error cloning accessor:', error);
    return null;
  }
}

/**
 * Clone a material to a new document
 */
function cloneMaterial(sourceMaterial: any, targetDoc: Document, targetBuffer: any): any | null {
  try {
    const targetMaterial = targetDoc.createMaterial(sourceMaterial.getName() || '');

    // Copy basic material properties
    targetMaterial.setAlphaMode(sourceMaterial.getAlphaMode());
    targetMaterial.setAlphaCutoff(sourceMaterial.getAlphaCutoff());
    targetMaterial.setDoubleSided(sourceMaterial.getDoubleSided());

    // Copy PBR properties
    const baseColorFactor = sourceMaterial.getBaseColorFactor();
    if (baseColorFactor) targetMaterial.setBaseColorFactor(baseColorFactor);

    const metallicFactor = sourceMaterial.getMetallicFactor();
    targetMaterial.setMetallicFactor(metallicFactor);

    const roughnessFactor = sourceMaterial.getRoughnessFactor();
    targetMaterial.setRoughnessFactor(roughnessFactor);

    const emissiveFactor = sourceMaterial.getEmissiveFactor();
    if (emissiveFactor) targetMaterial.setEmissiveFactor(emissiveFactor);

    // Copy textures
    const baseColorTexture = sourceMaterial.getBaseColorTexture();
    if (baseColorTexture) {
      const clonedTexture = cloneTexture(baseColorTexture, targetDoc);
      if (clonedTexture) targetMaterial.setBaseColorTexture(clonedTexture);
    }

    const metallicRoughnessTexture = sourceMaterial.getMetallicRoughnessTexture();
    if (metallicRoughnessTexture) {
      const clonedTexture = cloneTexture(metallicRoughnessTexture, targetDoc);
      if (clonedTexture) targetMaterial.setMetallicRoughnessTexture(clonedTexture);
    }

    const normalTexture = sourceMaterial.getNormalTexture();
    if (normalTexture) {
      const clonedTexture = cloneTexture(normalTexture, targetDoc);
      if (clonedTexture) targetMaterial.setNormalTexture(clonedTexture);
    }

    const occlusionTexture = sourceMaterial.getOcclusionTexture();
    if (occlusionTexture) {
      const clonedTexture = cloneTexture(occlusionTexture, targetDoc);
      if (clonedTexture) targetMaterial.setOcclusionTexture(clonedTexture);
    }

    const emissiveTexture = sourceMaterial.getEmissiveTexture();
    if (emissiveTexture) {
      const clonedTexture = cloneTexture(emissiveTexture, targetDoc);
      if (clonedTexture) targetMaterial.setEmissiveTexture(clonedTexture);
    }

    return targetMaterial;
  } catch (error) {
    log.error('[GLTF Export] Error cloning material:', error);
    return null;
  }
}

/**
 * Clone a texture to a new document
 */
function cloneTexture(sourceTexture: any, targetDoc: Document): any | null {
  try {
    const targetTexture = targetDoc.createTexture(sourceTexture.getName() || '');

    // Copy image data
    const sourceImage = sourceTexture.getImage();
    if (sourceImage) {
      targetTexture.setImage(sourceImage);
      const mimeType = sourceTexture.getMimeType();
      if (mimeType) {
        targetTexture.setMimeType(mimeType);
      }
    }

    return targetTexture;
  } catch (error) {
    log.error('[GLTF Export] Error cloning texture:', error);
    return null;
  }
}

