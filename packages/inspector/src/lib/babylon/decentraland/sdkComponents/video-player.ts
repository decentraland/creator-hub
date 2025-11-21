import type * as BABYLON from '@babylonjs/core';
import { Mesh, Vector3, VertexBuffer } from '@babylonjs/core';
import { ComponentType, type PBVideoPlayer } from '@dcl/ecs';
import videoPlayerGlbDataUrl from '../../assets/video_player.glb';
import type { ComponentOperation } from '../component-operations';
import type { EcsEntity } from '../EcsEntity';
import { loadBundledGltf } from './gltf-container';

// UV region to focus on (top-left quadrant)
// Adjust these values to focus on different parts of the texture
// Format: [u_min, v_min, u_max, v_max] where 0,0 is bottom-left and 1,1 is top-right
const UV_REGION = {
  uMin: 0, // left edge
  vMin: 0.65, // middle (to get top half)
  uMax: 0.435, // middle (to get left half)
  vMax: 1, // top edge
};

/**
 * Analyzes mesh transformation to determine UV flip requirements.
 * Uses a data-driven approach to handle different scale patterns.
 */
const analyzeMeshOrientation = (mesh: BABYLON.AbstractMesh): { flipU: boolean; flipV: boolean } => {
  const worldMatrix = mesh.computeWorldMatrix(true);
  const scaling = new Vector3();
  worldMatrix.decompose(scaling);

  // Identify which axes have negative scale
  const axes = {
    x: scaling.x < 0,
    y: scaling.y < 0,
    z: scaling.z < 0,
  };

  // Check if XZ scaling is uniform (for aspect ratio detection)
  const isUniformXZ = Math.abs(Math.abs(scaling.x) - Math.abs(scaling.z)) < 0.01;

  // Calculate average UV winding across multiple triangles
  const hasReversedUVs = analyzeUVWinding(mesh);

  // Apply flip rules based on transformation pattern
  return determineUVFlips(axes, isUniformXZ, hasReversedUVs);
};

/**
 * Determines UV flips based on axis negation pattern.
 * Uses a declarative rule set for clarity and maintainability.
 */
const determineUVFlips = (
  axes: { x: boolean; y: boolean; z: boolean },
  isUniformXZ: boolean,
  hasReversedUVs: boolean,
): { flipU: boolean; flipV: boolean } => {
  const negativeCount = Object.values(axes).filter(Boolean).length;

  // Single axis negation
  if (negativeCount === 1) {
    if (axes.x) return { flipU: true, flipV: false };
    if (axes.z) return { flipU: false, flipV: true };

    // Negative Y: UV winding-based with scale uniformity consideration
    if (axes.y) {
      const flipU = isUniformXZ ? !hasReversedUVs : hasReversedUVs;
      return { flipU, flipV: false };
    }
  }

  // Multiple axes negation: flip both coordinates
  if (negativeCount >= 2) {
    return { flipU: true, flipV: true };
  }

  // No negation: no flip
  return { flipU: false, flipV: false };
};

/**
 * Analyzes UV winding order by sampling triangles across the mesh.
 * Returns true if UVs have clockwise winding (reversed).
 */
const analyzeUVWinding = (mesh: BABYLON.AbstractMesh): boolean => {
  if (!(mesh instanceof Mesh)) return false;

  const uvs = mesh.getVerticesData(VertexBuffer.UVKind);
  const indices = mesh.getIndices();

  if (!uvs || !indices || indices.length < 3) return false;

  // Sample up to 10 triangles evenly distributed across the mesh
  const maxSamples = Math.min(10, Math.floor(indices.length / 3));
  const step = Math.floor(indices.length / 3 / maxSamples);
  let totalSignedArea = 0;
  let validSamples = 0;

  for (let i = 0; i < maxSamples; i++) {
    const triIndex = i * step * 3;
    const [idx0, idx1, idx2] = [
      indices[triIndex] * 2,
      indices[triIndex + 1] * 2,
      indices[triIndex + 2] * 2,
    ];

    // Calculate signed area of UV triangle
    const signedArea =
      (uvs[idx1] - uvs[idx0]) * (uvs[idx2 + 1] - uvs[idx0 + 1]) -
      (uvs[idx2] - uvs[idx0]) * (uvs[idx1 + 1] - uvs[idx0 + 1]);

    // Skip degenerate triangles
    if (Math.abs(signedArea) > 0.0001) {
      totalSignedArea += signedArea;
      validSamples++;
    }
  }

  const averageSignedArea = validSamples > 0 ? totalSignedArea / validSamples : 0;

  // Threshold check: significantly negative area indicates reversed winding
  return averageSignedArea < -0.01;
};

const adjustMeshUVs = (mesh: BABYLON.AbstractMesh, entity: EcsEntity) => {
  if (!(mesh instanceof Mesh)) {
    return;
  }

  const uvs = mesh.getVerticesData(VertexBuffer.UVKind);
  if (!uvs) {
    return;
  }

  const context = entity.context.deref();
  if (!context) {
    return;
  }

  const { uMin, vMin, uMax, vMax } = UV_REGION;
  const uRange = uMax - uMin;
  const vRange = vMax - vMin;

  // Detect mesh type using ECS components
  const hasMeshRenderer = context.MeshRenderer.has(entity.entityId);
  const hasGltfContainer = context.GltfContainer.has(entity.entityId);

  // Analyze mesh orientation to determine UV flips
  let shouldFlipU = false;
  let shouldFlipV = false;

  if (hasMeshRenderer) {
    // MeshRenderer primitives have negative Z-scale applied
    // They need V flip but not U flip
    shouldFlipU = false;
    shouldFlipV = true;
  } else if (hasGltfContainer) {
    // GLTF meshes: analyze their transformation to detect flips
    const orientation = analyzeMeshOrientation(mesh);
    shouldFlipU = orientation.flipU;
    shouldFlipV = orientation.flipV;
  }

  // Map UVs to focus on specific region
  const adjustedUVs = uvs.map((value, index) => {
    if (index % 2 === 0) {
      // U coordinate
      const mappedU = uMin + value * uRange;
      return shouldFlipU ? uMin + uMax - mappedU : mappedU;
    } else {
      // V coordinate
      const mappedV = vMin + value * vRange;
      return shouldFlipV ? vMin + vMax - mappedV : mappedV;
    }
  });

  mesh.setVerticesData(VertexBuffer.UVKind, adjustedUVs);
};

const loadVideoPlayerGLB = async (entity: EcsEntity): Promise<BABYLON.Material | null> => {
  // Return cached material if already loaded
  if (entity.videoPlayerMaterialAssetContainer) {
    return entity.videoPlayerMaterialAssetContainer.materials[0] || null;
  }

  // Check if already loading
  if (entity.isVideoPlayerMaterialLoading()) {
    const assetContainer = await entity.onVideoPlayerMaterialLoaded();
    return assetContainer.materials[0] || null;
  }

  // Load bundled video player GLB
  const assetContainer = await loadBundledGltf(entity, videoPlayerGlbDataUrl, 'video_player.glb');

  assetContainer.meshes
    .filter(mesh => mesh.name === '__root__')
    .forEach(mesh => {
      mesh.parent = entity;
      mesh.setEnabled(false);
    });

  // Extract the material from the loaded GLTF
  if (assetContainer.materials.length > 0) {
    entity.setVideoPlayerMaterialAssetContainer(assetContainer);
    return assetContainer.materials[0];
  }

  return null;
};

/**
 * Apply video player material to the entity's mesh renderer
 * This should be called whenever the mesh renderer is created/updated
 */
export const applyVideoPlayerMaterial = async (entity: EcsEntity): Promise<void> => {
  const context = entity.context.deref();
  if (!context) {
    return;
  }

  // Check if entity has VideoPlayer component
  const hasVideoPlayer = context.VideoPlayer.has(entity.entityId);
  if (!hasVideoPlayer || !entity.meshRenderer) {
    return;
  }

  try {
    // Load the video player GLB and extract its material (uses cache if available)
    const glbMaterial = await loadVideoPlayerGLB(entity);

    if (glbMaterial && entity.meshRenderer) {
      // Adjust UVs to focus on specific region of the texture
      // Uses ECS components to detect mesh type and orientation
      adjustMeshUVs(entity.meshRenderer, entity);

      // Apply the material from the GLB to the existing meshRenderer
      // This is runtime-only and doesn't modify the ECS component
      entity.meshRenderer.material = glbMaterial;
    }
  } catch (error) {
    console.error('Error applying video player material:', error);
  }
};

/**
 * Apply video player material to the entity's GLTF container meshes
 * This should be called whenever the GLTF container is loaded
 */
export const applyVideoPlayerMaterialToGltf = async (entity: EcsEntity): Promise<void> => {
  const context = entity.context.deref();
  if (!context) {
    return;
  }

  // Check if entity has VideoPlayer component
  const hasVideoPlayer = context.VideoPlayer.has(entity.entityId);
  if (!hasVideoPlayer || !entity.gltfContainer) {
    return;
  }

  try {
    // Load the video player GLB and extract its material (uses cache if available)
    const glbMaterial = await loadVideoPlayerGLB(entity);

    if (glbMaterial && entity.gltfContainer) {
      // Get all child meshes from the GLTF container
      const childMeshes = entity.gltfContainer.getChildMeshes(false);

      // Apply material and adjust UVs for each mesh
      for (const mesh of childMeshes) {
        // Adjust UVs to focus on specific region of the texture
        // Uses ECS components to detect mesh type and orientation
        adjustMeshUVs(mesh, entity);

        // Apply the material from the GLB to the mesh
        // This is runtime-only and doesn't modify the ECS component
        mesh.material = glbMaterial;
      }
    }
  } catch (error) {
    console.error('Error applying video player material to GLTF:', error);
  }
};

export const putVideoPlayerComponent: ComponentOperation = async (entity, component) => {
  if (component.componentType !== ComponentType.LastWriteWinElementSet) {
    return;
  }

  const newValue = component.getOrNull(entity.entityId) as PBVideoPlayer | null;

  if (!newValue) {
    return;
  }

  // Apply to mesh renderer if it exists
  if (entity.meshRenderer) {
    await applyVideoPlayerMaterial(entity);
  }

  // Apply to GLTF container if it exists
  if (entity.gltfContainer) {
    await applyVideoPlayerMaterialToGltf(entity);
  }
};
