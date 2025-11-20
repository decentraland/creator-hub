import type * as BABYLON from '@babylonjs/core';
import { Mesh, VertexBuffer } from '@babylonjs/core';
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
 * Detects if a mesh has a flipped/inverted orientation based on its world matrix.
 * A negative determinant indicates the mesh is flipped (mirrored).
 */
const isMeshFlipped = (mesh: BABYLON.AbstractMesh): boolean => {
  // Get the world matrix to account for all parent transformations
  const worldMatrix = mesh.computeWorldMatrix(true);

  // Calculate the determinant to detect if the mesh is flipped
  // A negative determinant means the mesh has an odd number of negative scale axes
  const determinant = worldMatrix.determinant();

  return determinant < 0;
};

const adjustMeshUVs = (mesh: BABYLON.AbstractMesh, isMeshRenderer: boolean = false) => {
  if (!(mesh instanceof Mesh)) {
    return;
  }

  const uvs = mesh.getVerticesData(VertexBuffer.UVKind);
  if (!uvs) {
    return;
  }

  const { uMin, vMin, uMax, vMax } = UV_REGION;
  const uRange = uMax - uMin;
  const vRange = vMax - vMin;

  // Detect if the mesh is flipped to adjust UVs accordingly
  const isFlipped = isMeshFlipped(mesh);

  // Map UVs to focus on specific region
  const adjustedUVs = uvs.map((value, index) => {
    if (index % 2 === 0) {
      // U coordinate
      const mappedU = uMin + value * uRange;
      // For mesh renderers with negative Z-scale, don't flip U
      // For GLTF meshes that are flipped, flip U
      return !isMeshRenderer && isFlipped ? uMin + uMax - mappedU : mappedU;
    } else {
      // V coordinate
      const mappedV = vMin + value * vRange;
      // For mesh renderers with negative Z-scale (sideOrientation: 2), flip V
      // For GLTF meshes that are flipped, no V flip needed
      return isMeshRenderer ? vMin + vMax - mappedV : mappedV;
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
      // Pass true to indicate this is a mesh renderer (which has negative Z-scale applied)
      adjustMeshUVs(entity.meshRenderer, true);

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
        // Pass false to indicate this is a GLTF mesh (uses flip detection)
        adjustMeshUVs(mesh, false);

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
