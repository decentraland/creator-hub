import type { Scene, Mesh, LinesMesh } from '@babylonjs/core';
import { TransformNode, Vector3 } from '@babylonjs/core';
import mitt from 'mitt';
import { memoize } from '../../logic/once';
import type { SceneSpawnPoint, SceneSpawnPointCoord } from '../../sdk/components';
import {
  createAvatarPlaceholderAsync,
  createOffsetArea,
  createCameraTargetCube,
  createOutOfBoundsIndicator,
  createCameraTargetOutOfBoundsIndicator,
  setSpawnPointSelected,
  setOffsetAreaSelected,
  setCameraTargetSelected,
  isSpawnPointMesh,
  isCameraTargetMesh,
  getSpawnPointIndexFromMesh,
} from './spawn-point-visuals';

export interface SpawnPointVisual {
  index: number;
  rootNode: TransformNode;
  avatarMesh: Mesh | null;
  areaMesh: Mesh | null;
  cameraTargetMesh: Mesh | null;
  outOfBoundsIndicator: LinesMesh | null;
  cameraTargetOutOfBoundsIndicator: LinesMesh | null;
  offsetX: number;
  offsetZ: number;
}

export type SpawnPointSelectionTarget = 'position' | 'cameraTarget';

type SelectionData = { index: number | null; target: SpawnPointSelectionTarget };

type SpawnPointManagerEvents = {
  selectionChange: SelectionData;
  positionChange: { index: number; position: Vector3 };
  cameraTargetPositionChange: { index: number; position: Vector3 };
  visibilityChange: { index: number; name: string; visible: boolean };
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

  const spawnPointsNode = new TransformNode('spawn_points', scene);

  const visuals: SpawnPointVisual[] = [];
  let selectedIndex: number | null = null;
  let selectedTarget: SpawnPointSelectionTarget = 'position';
  let updateGeneration = 0;
  const hiddenNames = new Set<string>();

  function getVisual(index: number): SpawnPointVisual | null {
    return index < visuals.length ? visuals[index] : null;
  }

  function setVisualSelected(visual: SpawnPointVisual, selected: boolean): void {
    if (visual.avatarMesh) setSpawnPointSelected(visual.avatarMesh, selected);
    if (visual.areaMesh) setOffsetAreaSelected(visual.areaMesh, selected);
    if (visual.cameraTargetMesh) setCameraTargetSelected(visual.cameraTargetMesh, selected);
  }

  function deselectCurrent(): void {
    const prevVisual = selectedIndex !== null ? getVisual(selectedIndex) : null;
    if (prevVisual) {
      setVisualSelected(prevVisual, false);
    }
  }

  function disposeMeshWithMaterial(mesh: Mesh | null): void {
    if (!mesh) return;
    mesh.getChildMeshes().forEach(child => {
      child.material?.dispose();
    });
    mesh.material?.dispose();
    mesh.dispose(false, true);
  }

  function disposeVisual(visual: SpawnPointVisual): void {
    visual.cameraTargetOutOfBoundsIndicator?.dispose();
    disposeMeshWithMaterial(visual.cameraTargetMesh);
    disposeMeshWithMaterial(visual.areaMesh);
    disposeMeshWithMaterial(visual.avatarMesh);
    visual.outOfBoundsIndicator?.dispose();
    visual.rootNode.dispose();
  }

  function clear(): void {
    for (const visual of visuals) {
      disposeVisual(visual);
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

    const offsetX = getOffsetRadius(spawnPoint.position.x);
    const offsetZ = getOffsetRadius(spawnPoint.position.z);

    const outOfBoundsIndicator = createOutOfBoundsIndicator(
      name,
      scene,
      rootNode,
      offsetX,
      offsetZ,
    );

    const avatarMesh = await createAvatarPlaceholderAsync(name, scene, rootNode);

    let areaMesh: Mesh | null = null;
    if (offsetX > 0 || offsetZ > 0) {
      areaMesh = createOffsetArea(name, scene, rootNode, offsetX, offsetZ);
    }

    // Parented to spawnPointsNode (not rootNode) so it stays in place during gizmo drag
    let cameraTargetMesh: Mesh | null = null;
    let cameraTargetOutOfBoundsIndicator: LinesMesh | null = null;
    if (spawnPoint.cameraTarget) {
      const { x: cx, y: cy, z: cz } = spawnPoint.cameraTarget;
      const targetPos = new Vector3(cx, cy, cz);
      cameraTargetMesh = createCameraTargetCube(name, scene, spawnPointsNode, targetPos);
      cameraTargetOutOfBoundsIndicator = createCameraTargetOutOfBoundsIndicator(
        name,
        scene,
        cameraTargetMesh,
      );

      if (avatarMesh) {
        rotateAvatarToFaceTarget(avatarMesh, rootNode.position, targetPos);
      }
    }

    return {
      index,
      rootNode,
      avatarMesh,
      areaMesh,
      cameraTargetMesh,
      outOfBoundsIndicator,
      cameraTargetOutOfBoundsIndicator,
      offsetX,
      offsetZ,
    };
  }

  function updateFromSceneComponent(spawnPoints: readonly SceneSpawnPoint[] | undefined): void {
    const points = spawnPoints || [];

    const previousSelectedIndex = selectedIndex;
    const previousSelectedTarget = selectedTarget;
    const thisGeneration = ++updateGeneration;

    clear();

    const promises = points.map((spawnPoint, index) => createSpawnPointVisual(spawnPoint, index));

    void Promise.all(promises).then(createdVisuals => {
      if (thisGeneration !== updateGeneration) {
        createdVisuals.forEach(disposeVisual);
        return;
      }

      visuals.push(...createdVisuals);

      for (const visual of createdVisuals) {
        const name = points[visual.index]?.name;
        if (name && hiddenNames.has(name)) {
          visual.rootNode.setEnabled(false);
          if (visual.cameraTargetMesh) visual.cameraTargetMesh.setEnabled(false);
        }
      }

      if (previousSelectedIndex !== null && previousSelectedIndex < visuals.length) {
        if (previousSelectedTarget === 'cameraTarget') {
          selectCameraTarget(previousSelectedIndex);
        } else {
          selectSpawnPoint(previousSelectedIndex);
        }
      }
    });
  }

  function selectSpawnPoint(index: number | null): void {
    deselectCurrent();

    selectedIndex = index;
    selectedTarget = 'position';

    const visual = index !== null ? getVisual(index) : null;
    if (visual) setVisualSelected(visual, true);

    events.emit('selectionChange', { index, target: 'position' });
  }

  function selectCameraTarget(index: number): void {
    deselectCurrent();

    selectedIndex = index;
    selectedTarget = 'cameraTarget';

    const visual = getVisual(index);
    if (visual) setVisualSelected(visual, true);

    events.emit('selectionChange', { index, target: 'cameraTarget' });
  }

  function getSelectedIndex(): number | null {
    return selectedIndex;
  }

  /** Gets transform node for gizmo attachment */
  function getSpawnPointNode(index: number): TransformNode | null {
    return getVisual(index)?.rootNode ?? null;
  }

  /** Gets camera target mesh for gizmo attachment */
  function getCameraTargetNode(index: number): TransformNode | null {
    return getVisual(index)?.cameraTargetMesh ?? null;
  }

  function onSelectionChange(cb: (data: SelectionData) => void): () => void {
    events.on('selectionChange', cb);
    return () => events.off('selectionChange', cb);
  }

  function setSpawnPointVisible(index: number, name: string, visible: boolean): void {
    if (visible) {
      hiddenNames.delete(name);
    } else {
      hiddenNames.add(name);
    }
    const visual = getVisual(index);
    if (visual) {
      visual.rootNode.setEnabled(visible);
      if (visual.cameraTargetMesh) visual.cameraTargetMesh.setEnabled(visible);
    }
    events.emit('visibilityChange', { index, name, visible });
  }

  function isSpawnPointHidden(name: string): boolean {
    return hiddenNames.has(name);
  }

  function setSpawnPointOutOfBoundsVisible(index: number, visible: boolean): void {
    const visual = getVisual(index);
    if (visual?.outOfBoundsIndicator) {
      visual.outOfBoundsIndicator.setEnabled(visible);
    }
  }

  function setCameraTargetOutOfBoundsVisible(index: number, visible: boolean): void {
    const visual = getVisual(index);
    if (visual?.cameraTargetOutOfBoundsIndicator) {
      visual.cameraTargetOutOfBoundsIndicator.setEnabled(visible);
    }
  }

  function getSpawnAreaHalfExtents(index: number): { x: number; z: number } | null {
    const visual = getVisual(index);
    if (!visual) return null;
    return { x: visual.offsetX, z: visual.offsetZ };
  }

  function onVisibilityChange(
    cb: (data: { index: number; name: string; visible: boolean }) => void,
  ): () => void {
    events.on('visibilityChange', cb);
    return () => events.off('visibilityChange', cb);
  }

  function dispose(): void {
    clear();
    spawnPointsNode.dispose();
  }

  return {
    updateFromSceneComponent,
    selectSpawnPoint,
    selectCameraTarget,
    getSelectedIndex,
    getSelectedTarget: () => selectedTarget,
    isMeshSpawnPoint: isSpawnPointMesh,
    isMeshCameraTarget: isCameraTargetMesh,
    findSpawnPointByMesh: getSpawnPointIndexFromMesh,
    getSpawnPointNode,
    getCameraTargetNode,
    setSpawnPointVisible,
    isSpawnPointHidden,
    setSpawnPointOutOfBoundsVisible,
    setCameraTargetOutOfBoundsVisible,
    getSpawnAreaHalfExtents,
    onSelectionChange,
    onVisibilityChange,
    dispose,
  };
});

export type SpawnPointManager = ReturnType<typeof createSpawnPointManager>;
