import type { Scene, Mesh } from '@babylonjs/core';
import { TransformNode, Vector3 } from '@babylonjs/core';
import mitt from 'mitt';
import { memoize } from '../../logic/once';
import type { SceneSpawnPoint, SceneSpawnPointCoord } from '../../sdk/components';
import {
  createAvatarPlaceholderAsync,
  createOffsetCircle,
  createCameraTargetArrow,
  setSpawnPointSelected,
  isSpawnPointMesh,
  getSpawnPointIndexFromMesh,
} from './spawn-point-visuals';

export interface SpawnPointVisual {
  index: number;
  rootNode: TransformNode;
  avatarMesh: Mesh | null;
  circleMesh: Mesh | null;
  cameraTargetMesh: Mesh | null;
}

type SpawnPointManagerEvents = {
  selectionChange: number | null;
  visibilityChange: boolean;
  positionChange: { index: number; position: Vector3 };
};

/**
 * Helper to extract position value from spawn point coordinate
 */
function getPositionValue(coord: SceneSpawnPointCoord): number {
  if (coord.$case === 'range') {
    if (coord.value.length === 1) {
      return coord.value[0];
    }
    return (coord.value[0] + coord.value[1]) / 2;
  }
  return coord.value;
}

/**
 * Helper to get offset radius from spawn point coordinate
 */
function getOffsetRadius(coord: SceneSpawnPointCoord): number {
  if (coord.$case === 'range' && coord.value.length === 2) {
    return Math.abs(coord.value[1] - coord.value[0]) / 2;
  }
  return 0;
}

/**
 * Creates a SpawnPointManager that handles visual representation of spawn points
 * Follows the layout-manager.ts pattern
 */
export const createSpawnPointManager = memoize((scene: Scene) => {
  const events = mitt<SpawnPointManagerEvents>();

  // Parent node for all spawn point visuals
  const spawnPointsNode = new TransformNode('spawn_points', scene);

  // State
  const visuals: SpawnPointVisual[] = [];
  let isVisible = true;
  let selectedIndex: number | null = null;

  /**
   * Clears all spawn point visuals
   */
  function clear(): void {
    let visual = visuals.pop();
    while (visual) {
      // Dispose all meshes
      if (visual.cameraTargetMesh) {
        visual.cameraTargetMesh.dispose(false, true);
      }
      if (visual.circleMesh) {
        visual.circleMesh.dispose(false, true);
      }
      if (visual.avatarMesh) {
        visual.avatarMesh.dispose(false, true);
      }
      visual.rootNode.dispose();
      visual = visuals.pop();
    }
    selectedIndex = null;
  }

  /**
   * Creates visual for a single spawn point (async due to GLB loading)
   */
  async function createSpawnPointVisual(
    spawnPoint: SceneSpawnPoint,
    index: number,
  ): Promise<SpawnPointVisual> {
    const name = `spawn_point_${index}`;

    // Create root transform node
    const rootNode = new TransformNode(name, scene);
    rootNode.parent = spawnPointsNode;

    // Calculate position
    const x = getPositionValue(spawnPoint.position.x);
    const y = getPositionValue(spawnPoint.position.y);
    const z = getPositionValue(spawnPoint.position.z);
    rootNode.position = new Vector3(x, y, z);

    // Create avatar placeholder (async - loads GLB)
    const avatarMesh = await createAvatarPlaceholderAsync(name, scene, rootNode);

    // Create offset circle if random offset is enabled
    const offsetX = getOffsetRadius(spawnPoint.position.x);
    const offsetZ = getOffsetRadius(spawnPoint.position.z);
    const maxOffset = Math.max(offsetX, offsetZ);
    let circleMesh: Mesh | null = null;
    if (maxOffset > 0) {
      circleMesh = createOffsetCircle(name, scene, rootNode, maxOffset);
    }

    // Camera target arrow is only shown when selected
    const cameraTargetMesh: Mesh | null = null;

    // Set visibility
    rootNode.setEnabled(isVisible);

    return {
      index,
      rootNode,
      avatarMesh,
      circleMesh,
      cameraTargetMesh,
    };
  }

  /**
   * Updates the camera target arrow for a spawn point
   */
  function updateCameraTargetArrow(visual: SpawnPointVisual, spawnPoint: SceneSpawnPoint): void {
    // Remove existing arrow
    if (visual.cameraTargetMesh) {
      visual.cameraTargetMesh.dispose(false, true);
      visual.cameraTargetMesh = null;
    }

    // Only show arrow when selected
    if (selectedIndex !== visual.index) {
      return;
    }

    // Create arrow if camera target exists
    if (spawnPoint.cameraTarget) {
      const spawnPos = visual.rootNode.position;
      const targetPos = new Vector3(
        spawnPoint.cameraTarget.x,
        spawnPoint.cameraTarget.y,
        spawnPoint.cameraTarget.z,
      );
      visual.cameraTargetMesh = createCameraTargetArrow(
        `spawn_point_${visual.index}`,
        scene,
        visual.rootNode,
        targetPos,
        spawnPos,
      );
    }
  }

  /**
   * Updates visuals from scene component spawn points
   */
  function updateFromSceneComponent(spawnPoints: readonly SceneSpawnPoint[] | undefined): void {
    const points = spawnPoints || [];

    // Clear existing visuals
    clear();

    // Create new visuals for each spawn point (async)
    const promises = points.map((spawnPoint, index) => createSpawnPointVisual(spawnPoint, index));

    // Handle async creation
    void Promise.all(promises).then(createdVisuals => {
      // Only update if no other update has happened in the meantime
      if (visuals.length === 0) {
        createdVisuals.forEach(visual => {
          visuals.push(visual);
        });
      }
    });
  }

  /**
   * Sets visibility of all spawn point visuals
   */
  function setVisible(visible: boolean): void {
    isVisible = visible;
    spawnPointsNode.setEnabled(visible);
    visuals.forEach(visual => {
      visual.rootNode.setEnabled(visible);
    });
    events.emit('visibilityChange', visible);
  }

  /**
   * Gets current visibility state
   */
  function getVisible(): boolean {
    return isVisible;
  }

  /**
   * Selects a spawn point by index
   */
  function selectSpawnPoint(index: number | null, spawnPoints?: readonly SceneSpawnPoint[]): void {
    // Deselect previous
    if (selectedIndex !== null && selectedIndex < visuals.length) {
      const prevVisual = visuals[selectedIndex];
      if (prevVisual.avatarMesh) {
        setSpawnPointSelected(prevVisual.avatarMesh, false);
      }
      // Remove camera target arrow
      if (prevVisual.cameraTargetMesh) {
        prevVisual.cameraTargetMesh.dispose(false, true);
        prevVisual.cameraTargetMesh = null;
      }
    }

    selectedIndex = index;

    // Select new
    if (index !== null && index < visuals.length) {
      const visual = visuals[index];
      if (visual.avatarMesh) {
        setSpawnPointSelected(visual.avatarMesh, true);
      }

      // Show camera target arrow if spawn points data is available
      if (spawnPoints && spawnPoints[index]) {
        updateCameraTargetArrow(visual, spawnPoints[index]);
      }
    }

    events.emit('selectionChange', index);
  }

  /**
   * Gets currently selected spawn point index
   */
  function getSelectedIndex(): number | null {
    return selectedIndex;
  }

  /**
   * Updates spawn point position (called from gizmo drag)
   */
  function updateSpawnPointPosition(index: number, position: Vector3): void {
    if (index < visuals.length) {
      visuals[index].rootNode.position = position.clone();
      events.emit('positionChange', { index, position: position.clone() });
    }
  }

  /**
   * Gets the transform node for a spawn point (for gizmo attachment)
   */
  function getSpawnPointNode(index: number): TransformNode | null {
    if (index < visuals.length) {
      return visuals[index].rootNode;
    }
    return null;
  }

  /**
   * Gets the position of a spawn point
   */
  function getSpawnPointPosition(index: number): Vector3 | null {
    if (index < visuals.length) {
      return visuals[index].rootNode.position.clone();
    }
    return null;
  }

  /**
   * Subscribes to events
   */
  function onSelectionChange(cb: (index: number | null) => void): () => void {
    events.on('selectionChange', cb);
    return () => events.off('selectionChange', cb);
  }

  function onVisibilityChange(cb: (visible: boolean) => void): () => void {
    events.on('visibilityChange', cb);
    return () => events.off('visibilityChange', cb);
  }

  function onPositionChange(cb: (data: { index: number; position: Vector3 }) => void): () => void {
    events.on('positionChange', cb);
    return () => events.off('positionChange', cb);
  }

  /**
   * Disposes the manager
   */
  function dispose(): void {
    clear();
    spawnPointsNode.dispose();
  }

  /**
   * Gets the number of spawn point visuals
   */
  function getCount(): number {
    return visuals.length;
  }

  return {
    updateFromSceneComponent,
    setVisible,
    getVisible,
    selectSpawnPoint,
    getSelectedIndex,
    isMeshSpawnPoint: isSpawnPointMesh,
    findSpawnPointByMesh: getSpawnPointIndexFromMesh,
    updateSpawnPointPosition,
    getSpawnPointNode,
    getSpawnPointPosition,
    getCount,
    onSelectionChange,
    onVisibilityChange,
    onPositionChange,
    dispose,
  };
});

export type SpawnPointManager = ReturnType<typeof createSpawnPointManager>;
