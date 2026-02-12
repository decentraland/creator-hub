import type { Scene, TransformNode, AbstractMesh, AssetContainer, Vector3 } from '@babylonjs/core';
import { MeshBuilder, StandardMaterial, Color3, Mesh } from '@babylonjs/core';

import spawnPointAvatarGlbDataUrl from '../assets/spawn_point_avatar.glb';
import { loadAssetContainer } from './sdkComponents/gltf-container';

const CAMERA_TARGET_CUBE_SIZE = 0.25;

const SPAWN_COLOR = Color3.FromHexString('#A855F7');
const SPAWN_SELECTED_COLOR = Color3.FromHexString('#FFD700');

let cachedAssetContainer: AssetContainer | null = null;
let loadingPromise: Promise<AssetContainer> | null = null;

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
  if (cachedAssetContainer) {
    return cachedAssetContainer;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
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
          cachedAssetContainer = assetContainer;
          resolve(assetContainer);
        },
        undefined,
        (_scene, message, exception) => {
          console.error('Error loading spawn point avatar GLB:', message, exception);
          loadingPromise = null;
          reject(new Error(message));
        },
        '.glb',
      );
    });
  })().catch(error => {
    console.error('Error loading spawn point avatar:', error);
    loadingPromise = null;
    throw error;
  });

  return loadingPromise;
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
        clonedMesh.material = mesh.material.clone(`${name}_${mesh.material.name}`);
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

  const material = createSpawnPointMaterial(`${name}_avatar_mat`, scene, SPAWN_COLOR);
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

  ground.material = createSpawnPointMaterial(`${name}_area_mat`, scene, SPAWN_COLOR, 0.5);
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

  cube.material = createSpawnPointMaterial(`${name}_camera_target_mat`, scene, SPAWN_COLOR, 0.8);
  cube.renderingGroupId = 1;
  cube.isPickable = true;

  return cube;
}

export function setSpawnPointSelected(avatarMesh: Mesh, selected: boolean): void {
  const color = selected ? SPAWN_SELECTED_COLOR : SPAWN_COLOR;

  avatarMesh.getChildMeshes().forEach(child => {
    if (child.material instanceof StandardMaterial) {
      child.material.diffuseColor = color;
      child.material.emissiveColor = color.scale(0.3);
    }
  });
}

export function setCameraTargetSelected(cameraTargetMesh: Mesh, selected: boolean): void {
  const color = selected ? SPAWN_SELECTED_COLOR : SPAWN_COLOR;
  if (cameraTargetMesh.material instanceof StandardMaterial) {
    cameraTargetMesh.material.diffuseColor = color;
    cameraTargetMesh.material.emissiveColor = color.scale(0.3);
  }
}

export function isCameraTargetMesh(mesh: AbstractMesh): boolean {
  return mesh.name.includes('_camera_target');
}

export function isSpawnPointMesh(mesh: AbstractMesh): boolean {
  return (
    mesh.name.includes('_avatar') ||
    mesh.name.includes('_offset_area') ||
    mesh.name.includes('_camera_target') ||
    mesh.name.includes('spawn_point_')
  );
}

export function getSpawnPointIndexFromMesh(mesh: AbstractMesh): number | null {
  const match = mesh.name.match(/spawn_point_(\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }

  let parent = mesh.parent;
  while (parent) {
    const parentMatch = parent.name.match(/spawn_point_(\d+)/);
    if (parentMatch) {
      return parseInt(parentMatch[1], 10);
    }
    parent = parent.parent;
  }

  return null;
}
