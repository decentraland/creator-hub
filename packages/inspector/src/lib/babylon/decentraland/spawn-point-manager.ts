import type { Scene, Mesh } from '@babylonjs/core';
import { TransformNode, Vector3 } from '@babylonjs/core';
import mitt from 'mitt';
import { memoize } from '../../logic/once';
import type { SceneSpawnPoint, SceneSpawnPointCoord } from '../../sdk/components';
import {
  createAvatarPlaceholderAsync,
  createOffsetArea,
  createCameraTargetCube,
  setSpawnPointSelected,
  setCameraTargetSelected,
  isSpawnPointMesh,
  isCameraTargetMesh as isCameraTargetMeshCheck,
  getSpawnPointIndexFromMesh,
} from './spawn-point-visuals';

export interface SpawnPointVisual {
  index: number;
  rootNode: TransformNode;
  avatarMesh: Mesh | null;
  areaMesh: Mesh | null;
  cameraTargetMesh: Mesh | null;
}

export type SpawnPointSelectionTarget = 'position' | 'cameraTarget';

type SelectionData = { index: number | null; target: SpawnPointSelectionTarget };

type SpawnPointManagerEvents = {
  selectionChange: SelectionData;
  positionChange: { index: number; position: Vector3 };
  cameraTargetPositionChange: { index: number; position: Vector3 };
};

/** Extracts position value from spawn point coordinate (midpoint for ranges) */
function getPositionValue(coord: SceneSpawnPointCoord): number {
  if (coord.$case === 'range') {
    if (coord.value.length === 1) {
      return coord.value[0];
    }
    return (coord.value[0] + coord.value[1]) / 2;
  }
  return coord.value;
}

/** Gets offset radius from spawn point coordinate range */
function getOffsetRadius(coord: SceneSpawnPointCoord): number {
  if (coord.$case === 'range' && coord.value.length === 2) {
    return Math.abs(coord.value[1] - coord.value[0]) / 2;
  }
  return 0;
}

/** Rotates avatar mesh on Y-axis to face a target position (horizontal look-at) */
function rotateAvatarToFaceTarget(avatarMesh: Mesh, spawnPos: Vector3, targetPos: Vector3): void {
  const dx = targetPos.x - spawnPos.x;
  const dz = targetPos.z - spawnPos.z;
  avatarMesh.rotation.y = Math.atan2(dx, dz);
}

/**
 * Creates a SpawnPointManager that handles visual representation of spawn points.
 * Follows the layout-manager.ts pattern (memoized per Babylon scene).
 */
export const createSpawnPointManager = memoize((scene: Scene) => {
  const events = mitt<SpawnPointManagerEvents>();

  // Parent node for all spawn point visuals
  const spawnPointsNode = new TransformNode('spawn_points', scene);

  // State
  const visuals: SpawnPointVisual[] = [];
  let selectedIndex: number | null = null;
  let selectedTarget: SpawnPointSelectionTarget = 'position';

  function getVisual(index: number): SpawnPointVisual | null {
    return index < visuals.length ? visuals[index] : null;
  }

  function deselectCurrent(): void {
    const prevVisual = selectedIndex !== null ? getVisual(selectedIndex) : null;
    if (prevVisual) {
      if (prevVisual.avatarMesh) setSpawnPointSelected(prevVisual.avatarMesh, false);
      if (prevVisual.cameraTargetMesh) setCameraTargetSelected(prevVisual.cameraTargetMesh, false);
    }
  }

  function clear(): void {
    for (const visual of visuals) {
      visual.cameraTargetMesh?.dispose(false, true);
      visual.areaMesh?.dispose(false, true);
      visual.avatarMesh?.dispose(false, true);
      visual.rootNode.dispose();
    }
    visuals.length = 0;
    selectedIndex = null;
    selectedTarget = 'position';
  }

  /** Creates visual for a single spawn point (async due to GLB loading) */
  async function createSpawnPointVisual(
    spawnPoint: SceneSpawnPoint,
    index: number,
  ): Promise<SpawnPointVisual> {
    const name = `spawn_point_${index}`;

    const rootNode = new TransformNode(name, scene);
    rootNode.parent = spawnPointsNode;

    const x = getPositionValue(spawnPoint.position.x);
    const y = getPositionValue(spawnPoint.position.y);
    const z = getPositionValue(spawnPoint.position.z);
    rootNode.position = new Vector3(x, y, z);

    const avatarMesh = await createAvatarPlaceholderAsync(name, scene, rootNode);

    const offsetX = getOffsetRadius(spawnPoint.position.x);
    const offsetZ = getOffsetRadius(spawnPoint.position.z);
    let areaMesh: Mesh | null = null;
    if (offsetX > 0 || offsetZ > 0) {
      areaMesh = createOffsetArea(name, scene, rootNode, offsetX, offsetZ);
    }

    // Parented to spawnPointsNode (not rootNode) so it stays in place during gizmo drag
    let cameraTargetMesh: Mesh | null = null;
    if (spawnPoint.cameraTarget) {
      const targetPos = new Vector3(
        spawnPoint.cameraTarget.x,
        spawnPoint.cameraTarget.y,
        spawnPoint.cameraTarget.z,
      );
      cameraTargetMesh = createCameraTargetCube(name, scene, spawnPointsNode, targetPos);
    }

    // Rotate avatar to face the camera target (Y-axis only)
    if (avatarMesh && spawnPoint.cameraTarget) {
      rotateAvatarToFaceTarget(
        avatarMesh,
        rootNode.position,
        new Vector3(
          spawnPoint.cameraTarget.x,
          spawnPoint.cameraTarget.y,
          spawnPoint.cameraTarget.z,
        ),
      );
    }

    return { index, rootNode, avatarMesh, areaMesh, cameraTargetMesh };
  }

  function updateFromSceneComponent(spawnPoints: readonly SceneSpawnPoint[] | undefined): void {
    const points = spawnPoints || [];

    // Save selection state before clearing so we can restore it after rebuild
    const previousSelectedIndex = selectedIndex;
    const previousSelectedTarget = selectedTarget;

    clear();

    const promises = points.map((spawnPoint, index) => createSpawnPointVisual(spawnPoint, index));

    void Promise.all(promises).then(createdVisuals => {
      // Only update if no other update has happened in the meantime
      if (visuals.length === 0) {
        visuals.push(...createdVisuals);

        // Restore selection after rebuild (e.g., after gizmo drag updates the component)
        if (previousSelectedIndex !== null && previousSelectedIndex < visuals.length) {
          if (previousSelectedTarget === 'cameraTarget') {
            selectCameraTarget(previousSelectedIndex);
          } else {
            selectSpawnPoint(previousSelectedIndex);
          }
        }
      }
    });
  }

  function selectSpawnPoint(index: number | null): void {
    deselectCurrent();

    selectedIndex = index;
    selectedTarget = 'position';

    // Select avatar only (not camera target)
    const visual = index !== null ? getVisual(index) : null;
    if (visual?.avatarMesh) {
      setSpawnPointSelected(visual.avatarMesh, true);
    }

    events.emit('selectionChange', { index, target: 'position' });
  }

  function selectCameraTarget(index: number): void {
    deselectCurrent();

    selectedIndex = index;
    selectedTarget = 'cameraTarget';

    // Select both avatar and camera target visuals
    const visual = getVisual(index);
    if (visual) {
      if (visual.avatarMesh) setSpawnPointSelected(visual.avatarMesh, true);
      if (visual.cameraTargetMesh) setCameraTargetSelected(visual.cameraTargetMesh, true);
    }

    events.emit('selectionChange', { index, target: 'cameraTarget' });
  }

  function getSelectedIndex(): number | null {
    return selectedIndex;
  }

  /** Called from gizmo drag to update spawn point position */
  function updateSpawnPointPosition(index: number, position: Vector3): void {
    const visual = getVisual(index);
    if (visual) {
      visual.rootNode.position = position.clone();
      // Update avatar facing direction since distance/angle to camera target changed
      if (visual.avatarMesh && visual.cameraTargetMesh) {
        rotateAvatarToFaceTarget(visual.avatarMesh, position, visual.cameraTargetMesh.position);
      }
      events.emit('positionChange', { index, position: position.clone() });
    }
  }

  /** Gets transform node for gizmo attachment */
  function getSpawnPointNode(index: number): TransformNode | null {
    return getVisual(index)?.rootNode ?? null;
  }

  /** Gets camera target mesh for gizmo attachment */
  function getCameraTargetNode(index: number): TransformNode | null {
    return getVisual(index)?.cameraTargetMesh ?? null;
  }

  function getSpawnPointPosition(index: number): Vector3 | null {
    return getVisual(index)?.rootNode.position.clone() ?? null;
  }

  /** Called from gizmo drag to update camera target position */
  function updateCameraTargetPosition(index: number, position: Vector3): void {
    const visual = getVisual(index);
    if (visual?.cameraTargetMesh) {
      visual.cameraTargetMesh.position = position.clone();
      // Update avatar facing direction to follow the new camera target
      if (visual.avatarMesh) {
        rotateAvatarToFaceTarget(visual.avatarMesh, visual.rootNode.position, position);
      }
      events.emit('cameraTargetPositionChange', { index, position: position.clone() });
    }
  }

  function onSelectionChange(cb: (data: SelectionData) => void): () => void {
    events.on('selectionChange', cb);
    return () => events.off('selectionChange', cb);
  }

  function onPositionChange(cb: (data: { index: number; position: Vector3 }) => void): () => void {
    events.on('positionChange', cb);
    return () => events.off('positionChange', cb);
  }

  function onCameraTargetPositionChange(
    cb: (data: { index: number; position: Vector3 }) => void,
  ): () => void {
    events.on('cameraTargetPositionChange', cb);
    return () => events.off('cameraTargetPositionChange', cb);
  }

  function dispose(): void {
    clear();
    spawnPointsNode.dispose();
  }

  function getCount(): number {
    return visuals.length;
  }

  return {
    updateFromSceneComponent,
    selectSpawnPoint,
    selectCameraTarget,
    getSelectedIndex,
    isMeshSpawnPoint: isSpawnPointMesh,
    isMeshCameraTarget: isCameraTargetMeshCheck,
    findSpawnPointByMesh: getSpawnPointIndexFromMesh,
    updateSpawnPointPosition,
    updateCameraTargetPosition,
    getSpawnPointNode,
    getCameraTargetNode,
    getSpawnPointPosition,
    getCount,
    onSelectionChange,
    onPositionChange,
    onCameraTargetPositionChange,
    dispose,
  };
});

export type SpawnPointManager = ReturnType<typeof createSpawnPointManager>;
