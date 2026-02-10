import type { Scene, TransformNode, AbstractMesh, AssetContainer, Vector3 } from '@babylonjs/core';
import { MeshBuilder, StandardMaterial, Color3, Mesh } from '@babylonjs/core';

import spawnIndicatorGlbDataUrl from '../assets/spawn_indicator.glb';
import { loadAssetContainer } from './sdkComponents/gltf-container';

// Constants for spawn point visual dimensions
const CAMERA_TARGET_CUBE_SIZE = 0.25;

// Material colors
const SPAWN_COLOR = Color3.FromHexString('#A855F7'); // Purple for spawn point
const SPAWN_SELECTED_COLOR = Color3.FromHexString('#FFD700'); // Gold for selected

/**
 * Configures a mesh for spawn point rendering (pickable, rendering group, etc.)
 */
function configureSpawnPointMesh(mesh: Mesh, isPickable: boolean = true): void {
  mesh.renderingGroupId = 1;
  mesh.isPickable = isPickable;
}

// Cache for the loaded GLB asset container
let cachedAssetContainer: AssetContainer | null = null;
let loadingPromise: Promise<AssetContainer> | null = null;

/**
 * Creates a semi-transparent material for spawn point visuals
 */
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

/**
 * Loads the spawn indicator GLB asset (cached)
 */
async function loadSpawnIndicatorGlb(scene: Scene): Promise<AssetContainer> {
  if (cachedAssetContainer) {
    return cachedAssetContainer;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    const response = await fetch(spawnIndicatorGlbDataUrl);
    const blob = await response.blob();
    const file = new File([blob], 'spawn_indicator.glb');

    return new Promise<AssetContainer>((resolve, reject) => {
      loadAssetContainer(
        file,
        scene,
        assetContainer => {
          // Note: We intentionally skip processGLTFAssetContainer here because it calls
          // addAllToScene() which would make the original meshes visible at the origin.
          // We only need the container for cloning, not for direct rendering.
          cachedAssetContainer = assetContainer;
          resolve(assetContainer);
        },
        undefined,
        (_scene, message, exception) => {
          console.error('Error loading spawn indicator GLB:', message, exception);
          loadingPromise = null;
          reject(new Error(message));
        },
        '.glb',
      );
    });
  })().catch(error => {
    console.error('Error loading spawn indicator:', error);
    loadingPromise = null;
    throw error;
  });

  return loadingPromise;
}

/**
 * Creates an instance of the spawn indicator mesh from the loaded GLB
 */
function createMeshInstance(
  assetContainer: AssetContainer,
  name: string,
  scene: Scene,
  parent: TransformNode,
): Mesh {
  // Create a root mesh for this spawn point
  const avatarRoot = new Mesh(`${name}_avatar`, scene);
  avatarRoot.parent = parent;

  // Clone meshes from the asset container
  assetContainer.meshes.forEach(mesh => {
    if (mesh.name === '__root__') return; // Skip the root node

    const clonedMesh = mesh.clone(`${name}_${mesh.name}`, avatarRoot);
    if (clonedMesh) {
      clonedMesh.isPickable = true;
      clonedMesh.renderingGroupId = 1;

      // Clone materials to allow individual color changes
      if (mesh.material) {
        const clonedMaterial = mesh.material.clone(`${name}_${mesh.material.name}`);
        clonedMesh.material = clonedMaterial;
      }
    }
  });

  avatarRoot.renderingGroupId = 1;

  return avatarRoot;
}

/**
 * Creates the avatar placeholder mesh from the GLB file (async)
 */
export async function createAvatarPlaceholderAsync(
  name: string,
  scene: Scene,
  parent: TransformNode,
): Promise<Mesh> {
  try {
    const assetContainer = await loadSpawnIndicatorGlb(scene);
    return createMeshInstance(assetContainer, name, scene, parent);
  } catch (error) {
    console.error('Failed to load spawn indicator GLB, falling back to placeholder:', error);
    // Fallback to simple placeholder if GLB fails to load
    return createFallbackPlaceholder(name, scene, parent);
  }
}

/**
 * Creates a simple fallback placeholder if GLB fails to load
 */
function createFallbackPlaceholder(name: string, scene: Scene, parent: TransformNode): Mesh {
  const AVATAR_HEIGHT = 1.75;
  const AVATAR_RADIUS = 0.3;

  const avatarRoot = new Mesh(`${name}_avatar`, scene);
  avatarRoot.parent = parent;

  // Create cylinder for body
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

  // Create sphere for head
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

  // Create sphere for bottom
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

  // Apply material and configure all parts
  const material = createSpawnPointMaterial(`${name}_avatar_mat`, scene, SPAWN_COLOR);
  [body, head, bottom].forEach(mesh => {
    mesh.material = material;
    configureSpawnPointMesh(mesh, true);
  });

  avatarRoot.renderingGroupId = 1;

  return avatarRoot;
}

/**
 * Creates a ground plane mesh for showing random offset area.
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
  configureSpawnPointMesh(ground, false);

  return ground;
}

/**
 * Creates a small cube mesh representing the camera target position
 */
export function createCameraTargetCube(
  name: string,
  scene: Scene,
  parent: TransformNode,
  targetPosition: Vector3,
  spawnPosition: Vector3,
): Mesh {
  const cube = MeshBuilder.CreateBox(
    `${name}_camera_target`,
    { size: CAMERA_TARGET_CUBE_SIZE },
    scene,
  );
  cube.parent = parent;

  // Position relative to parent (spawn point root)
  cube.position = targetPosition.subtract(spawnPosition);

  cube.material = createSpawnPointMaterial(`${name}_camera_target_mat`, scene, SPAWN_COLOR, 0.8);
  configureSpawnPointMesh(cube, false);

  cube.renderingGroupId = 1;

  return cube;
}

/**
 * Updates the selection state visual of a spawn point
 */
export function setSpawnPointSelected(avatarMesh: Mesh, selected: boolean): void {
  const color = selected ? SPAWN_SELECTED_COLOR : SPAWN_COLOR;

  // Update material for all child meshes
  avatarMesh.getChildMeshes().forEach(child => {
    if (child.material instanceof StandardMaterial) {
      child.material.diffuseColor = color;
      child.material.emissiveColor = color.scale(0.3);
    }
  });
}

/**
 * Updates the offset area dimensions
 */
export function updateOffsetArea(area: Mesh, scene: Scene, offsetX: number, offsetZ: number): Mesh {
  // Dispose old mesh and create new one with updated dimensions
  const parent = area.parent as TransformNode;
  const name = area.name.replace('_offset_area', '');
  area.dispose();

  return createOffsetArea(name, scene, parent, offsetX, offsetZ);
}

/**
 * Checks if a mesh belongs to a spawn point visual
 */
export function isSpawnPointMesh(mesh: AbstractMesh): boolean {
  return (
    mesh.name.includes('_avatar') ||
    mesh.name.includes('_offset_area') ||
    mesh.name.includes('_camera_target') ||
    mesh.name.includes('spawn_point_')
  );
}

/**
 * Gets the spawn point index from a mesh name
 */
export function getSpawnPointIndexFromMesh(mesh: AbstractMesh): number | null {
  const match = mesh.name.match(/spawn_point_(\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }

  // Check parent chain
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
