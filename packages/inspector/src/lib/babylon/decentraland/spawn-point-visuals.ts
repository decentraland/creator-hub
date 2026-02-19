import type {
  Scene,
  TransformNode,
  AbstractMesh,
  AssetContainer,
  LinesMesh,
} from '@babylonjs/core';
import { MeshBuilder, StandardMaterial, PBRMaterial, Color3, Mesh, Vector3 } from '@babylonjs/core';

import spawnPointAvatarGlbDataUrl from '../assets/spawn_point_avatar.glb';
import { loadAssetContainer } from './sdkComponents/gltf-container';

/** Metadata stored on cloned PBR materials to restore original appearance on deselect. */
interface SpawnPointMaterialMetadata {
  originalAlbedoColor: Color3;
  originalEmissiveColor: Color3;
  originalAlpha: number;
  originalTransparencyMode: number | null;
}

const SPAWN_POINT_PREFIX = 'spawn_point_';
const SPAWN_COLOR = Color3.FromHexString('#A855F7');
const AVATAR_ALPHA_UNSELECTED = 0.35;
const AREA_ALPHA_UNSELECTED = 0.2;
const AREA_ALPHA_SELECTED = 0.5;
const CAMERA_TARGET_CUBE_SIZE = 0.25;
const CAMERA_TARGET_ALPHA_UNSELECTED = 0.5;
const CAMERA_TARGET_ALPHA_SELECTED = 0.9;
const OUT_OF_BOUNDS_COLOR = Color3.FromHexString('#FF9500');
const OUT_OF_BOUNDS_HEIGHT = 2.0;
const OUT_OF_BOUNDS_MIN_HALF_EXTENT = 0.3;
const CAMERA_TARGET_OOB_HALF_EXTENT = CAMERA_TARGET_CUBE_SIZE / 2 + 0.1;

// GLB asset cache scoped per scene to avoid stale references after scene disposal
const sceneCaches = new WeakMap<
  Scene,
  { container: AssetContainer | null; promise: Promise<AssetContainer> | null }
>();

function getSceneCache(scene: Scene) {
  let cache = sceneCaches.get(scene);
  if (!cache) {
    cache = { container: null, promise: null };
    sceneCaches.set(scene, cache);
  }
  return cache;
}

export function createSpawnPointMaterial(
  name: string,
  scene: Scene,
  color: Color3,
  alpha: number = 0.6,
): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = color;
  material.emissiveColor = color.scale(0.3);
  material.alpha = alpha;
  material.backFaceCulling = false;
  material.zOffset = -1;
  return material;
}

async function loadSpawnPointAvatarGlb(scene: Scene): Promise<AssetContainer> {
  const cache = getSceneCache(scene);

  if (cache.container) {
    return cache.container;
  }

  if (cache.promise) {
    return cache.promise;
  }

  cache.promise = (async () => {
    const response = await fetch(spawnPointAvatarGlbDataUrl);
    const blob = await response.blob();
    const file = new File([blob], 'spawn_point_avatar.glb');

    return new Promise<AssetContainer>((resolve, reject) => {
      loadAssetContainer(
        file,
        scene,
        assetContainer => {
          // Skip processGLTFAssetContainer here because addAllToScene() would make
          // the original meshes visible at the origin. We only need the container for cloning.
          cache.container = assetContainer;
          resolve(assetContainer);
        },
        undefined,
        (_scene, message, exception) => {
          console.error('Error loading spawn point avatar GLB:', message, exception);
          cache.promise = null;
          reject(new Error(message));
        },
        '.glb',
      );
    });
  })().catch(error => {
    console.error('Error loading spawn point avatar:', error);
    cache.promise = null;
    throw error;
  });

  return cache.promise;
}

function createMeshInstance(
  assetContainer: AssetContainer,
  name: string,
  scene: Scene,
  parent: TransformNode,
): Mesh {
  const avatarRoot = new Mesh(`${name}_avatar`, scene);
  avatarRoot.parent = parent;

  assetContainer.meshes.forEach(mesh => {
    if (mesh.name === '__root__') return;

    const clonedMesh = mesh.clone(`${name}_${mesh.name}`, avatarRoot);
    if (clonedMesh) {
      clonedMesh.isPickable = true;
      clonedMesh.renderingGroupId = 1;

      if (mesh.material) {
        const clonedMaterial = mesh.material.clone(`${name}_${mesh.material.name}`);
        if (clonedMaterial) {
          // Store original values so we can restore them when selected
          if (clonedMaterial instanceof PBRMaterial) {
            const spawnMeta: SpawnPointMaterialMetadata = {
              originalAlbedoColor: clonedMaterial.albedoColor.clone(),
              originalEmissiveColor: clonedMaterial.emissiveColor.clone(),
              originalAlpha: clonedMaterial.alpha,
              originalTransparencyMode: clonedMaterial.transparencyMode,
            };
            clonedMaterial.metadata = { ...clonedMaterial.metadata, ...spawnMeta };
            clonedMaterial.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
            clonedMaterial.albedoColor = SPAWN_COLOR;
            clonedMaterial.emissiveColor = SPAWN_COLOR.scale(0.3);
          }
          clonedMaterial.alpha = AVATAR_ALPHA_UNSELECTED;
        }
        clonedMesh.material = clonedMaterial;
      }
    }
  });

  avatarRoot.renderingGroupId = 1;

  return avatarRoot;
}

export async function createAvatarPlaceholderAsync(
  name: string,
  scene: Scene,
  parent: TransformNode,
): Promise<Mesh> {
  try {
    const assetContainer = await loadSpawnPointAvatarGlb(scene);
    return createMeshInstance(assetContainer, name, scene, parent);
  } catch (error) {
    console.error('Failed to load spawn point avatar GLB, falling back to placeholder:', error);
    return createFallbackPlaceholder(name, scene, parent);
  }
}

function createFallbackPlaceholder(name: string, scene: Scene, parent: TransformNode): Mesh {
  const AVATAR_HEIGHT = 1.75;
  const AVATAR_RADIUS = 0.3;

  const avatarRoot = new Mesh(`${name}_avatar`, scene);
  avatarRoot.parent = parent;

  const bodyHeight = AVATAR_HEIGHT - AVATAR_RADIUS * 2;
  const body = MeshBuilder.CreateCylinder(
    `${name}_avatar_body`,
    {
      height: bodyHeight,
      diameter: AVATAR_RADIUS * 2,
      tessellation: 16,
    },
    scene,
  );
  body.parent = avatarRoot;
  body.position.y = AVATAR_RADIUS + bodyHeight / 2;

  const head = MeshBuilder.CreateSphere(
    `${name}_avatar_head`,
    {
      diameter: AVATAR_RADIUS * 2,
      segments: 12,
    },
    scene,
  );
  head.parent = avatarRoot;
  head.position.y = AVATAR_HEIGHT - AVATAR_RADIUS;

  const bottom = MeshBuilder.CreateSphere(
    `${name}_avatar_bottom`,
    {
      diameter: AVATAR_RADIUS * 2,
      segments: 12,
    },
    scene,
  );
  bottom.parent = avatarRoot;
  bottom.position.y = AVATAR_RADIUS;

  const material = createSpawnPointMaterial(
    `${name}_avatar_mat`,
    scene,
    SPAWN_COLOR,
    AVATAR_ALPHA_UNSELECTED,
  );
  [body, head, bottom].forEach(mesh => {
    mesh.material = material;
    mesh.renderingGroupId = 1;
    mesh.isPickable = true;
  });

  avatarRoot.renderingGroupId = 1;

  return avatarRoot;
}

/**
 * Creates a ground plane mesh showing the random offset area.
 * The offset extends equally in +/- X and +/- Z, forming a rectangular area.
 */
export function createOffsetArea(
  name: string,
  scene: Scene,
  parent: TransformNode,
  offsetX: number,
  offsetZ: number,
): Mesh {
  const ground = MeshBuilder.CreateGround(
    `${name}_offset_area`,
    {
      width: offsetX * 2,
      height: offsetZ * 2,
    },
    scene,
  );
  ground.parent = parent;
  ground.position.y = 0.01; // Slightly above ground to avoid z-fighting

  ground.material = createSpawnPointMaterial(
    `${name}_area_mat`,
    scene,
    SPAWN_COLOR,
    AREA_ALPHA_UNSELECTED,
  );
  ground.renderingGroupId = 1;
  ground.isPickable = false;

  return ground;
}

/**
 * Creates a small cube representing the camera target position.
 * Parented to a stable node (not the spawn point root) so it stays in place
 * when the user drags the avatar with the gizmo.
 */
export function createCameraTargetCube(
  name: string,
  scene: Scene,
  parent: TransformNode,
  targetPosition: Vector3,
): Mesh {
  const cube = MeshBuilder.CreateBox(
    `${name}_camera_target`,
    { size: CAMERA_TARGET_CUBE_SIZE },
    scene,
  );
  cube.parent = parent;
  cube.position = targetPosition.clone();

  cube.material = createSpawnPointMaterial(
    `${name}_camera_target_mat`,
    scene,
    SPAWN_COLOR,
    CAMERA_TARGET_ALPHA_UNSELECTED,
  );
  cube.renderingGroupId = 1;
  cube.isPickable = true;
  cube.setEnabled(false);

  return cube;
}

export function setSpawnPointSelected(avatarMesh: Mesh, selected: boolean): void {
  avatarMesh.getChildMeshes().forEach(child => {
    if (!child.material) return;

    const isPBR =
      child.material instanceof PBRMaterial && child.material.metadata?.originalAlbedoColor;
    if (!isPBR) {
      child.material.alpha = selected ? 1 : AVATAR_ALPHA_UNSELECTED;
      return;
    }

    const material = child.material as PBRMaterial;
    if (selected) {
      const meta = material.metadata as SpawnPointMaterialMetadata;
      material.albedoColor = meta.originalAlbedoColor;
      material.emissiveColor = meta.originalEmissiveColor;
      material.alpha = meta.originalAlpha;
      material.transparencyMode = meta.originalTransparencyMode;
    } else {
      material.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
      material.albedoColor = SPAWN_COLOR;
      material.emissiveColor = SPAWN_COLOR.scale(0.3);
      material.alpha = AVATAR_ALPHA_UNSELECTED;
    }
  });
}

export function setOffsetAreaSelected(areaMesh: Mesh, selected: boolean): void {
  const alpha = selected ? AREA_ALPHA_SELECTED : AREA_ALPHA_UNSELECTED;
  if (areaMesh.material) {
    areaMesh.material.alpha = alpha;
  }
}

export function setCameraTargetSelected(cameraTargetMesh: Mesh, selected: boolean): void {
  cameraTargetMesh.setEnabled(selected);
  const alpha = selected ? CAMERA_TARGET_ALPHA_SELECTED : CAMERA_TARGET_ALPHA_UNSELECTED;
  if (cameraTargetMesh.material) {
    cameraTargetMesh.material.alpha = alpha;
  }
}

export function isCameraTargetMesh(mesh: AbstractMesh): boolean {
  return mesh.name.includes(SPAWN_POINT_PREFIX) && mesh.name.includes('_camera_target');
}

export function isSpawnPointMesh(mesh: AbstractMesh): boolean {
  if (mesh.name.startsWith(SPAWN_POINT_PREFIX)) return true;
  // Child meshes of spawn points are parented under a spawn_point_ node
  let parent = mesh.parent;
  while (parent) {
    if (parent.name.startsWith(SPAWN_POINT_PREFIX)) return true;
    parent = parent.parent;
  }
  return false;
}

/** Creates a wireframe box as a LinesMesh, used for out-of-bounds indicators */
function createWireframeBox(
  meshName: string,
  scene: Scene,
  parent: TransformNode,
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
): LinesMesh {
  const lines = [
    // Bottom
    [new Vector3(minX, minY, minZ), new Vector3(maxX, minY, minZ)],
    [new Vector3(maxX, minY, minZ), new Vector3(maxX, minY, maxZ)],
    [new Vector3(maxX, minY, maxZ), new Vector3(minX, minY, maxZ)],
    [new Vector3(minX, minY, maxZ), new Vector3(minX, minY, minZ)],
    // Top
    [new Vector3(minX, maxY, minZ), new Vector3(maxX, maxY, minZ)],
    [new Vector3(maxX, maxY, minZ), new Vector3(maxX, maxY, maxZ)],
    [new Vector3(maxX, maxY, maxZ), new Vector3(minX, maxY, maxZ)],
    [new Vector3(minX, maxY, maxZ), new Vector3(minX, maxY, minZ)],
    // Verticals
    [new Vector3(minX, minY, minZ), new Vector3(minX, maxY, minZ)],
    [new Vector3(maxX, minY, minZ), new Vector3(maxX, maxY, minZ)],
    [new Vector3(maxX, minY, maxZ), new Vector3(maxX, maxY, maxZ)],
    [new Vector3(minX, minY, maxZ), new Vector3(minX, maxY, maxZ)],
  ];
  const mesh = MeshBuilder.CreateLineSystem(meshName, { lines }, scene);
  mesh.parent = parent;
  mesh.color = OUT_OF_BOUNDS_COLOR;
  mesh.isPickable = false;
  mesh.renderingGroupId = 1;
  mesh.setEnabled(false);
  return mesh;
}

/** Wireframe cube centered on the parent mesh, shown when camera target exits bounds */
export function createCameraTargetOutOfBoundsIndicator(
  name: string,
  scene: Scene,
  parent: TransformNode,
): LinesMesh {
  const s = CAMERA_TARGET_OOB_HALF_EXTENT;
  return createWireframeBox(`${name}_camera_target_oob`, scene, parent, -s, -s, -s, s, s, s);
}

export function getSpawnPointIndexFromMesh(mesh: AbstractMesh): number | null {
  const pattern = /spawn_point_(\d+)/;
  let node: { name: string; parent: any } | null = mesh;
  while (node) {
    const match = node.name.match(pattern);
    if (match) return parseInt(match[1], 10);
    node = node.parent;
  }
  return null;
}

/** Wireframe box matching the spawn area footprint, shown when spawn point exits bounds */
export function createOutOfBoundsIndicator(
  name: string,
  scene: Scene,
  parent: TransformNode,
  halfExtentX: number,
  halfExtentZ: number,
): LinesMesh {
  const wx = Math.max(halfExtentX, OUT_OF_BOUNDS_MIN_HALF_EXTENT);
  const wz = Math.max(halfExtentZ, OUT_OF_BOUNDS_MIN_HALF_EXTENT);
  return createWireframeBox(
    `${name}_out_of_bounds`,
    scene,
    parent,
    -wx,
    0,
    -wz,
    wx,
    OUT_OF_BOUNDS_HEIGHT,
    wz,
  );
}
