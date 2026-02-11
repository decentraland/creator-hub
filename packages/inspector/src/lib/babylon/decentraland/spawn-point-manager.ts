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
  let selectedIndex: number | null = null;
  let selectedTarget: SpawnPointSelectionTarget = 'position';

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
      if (visual.areaMesh) {
        visual.areaMesh.dispose(false, true);
      }
      if (visual.avatarMesh) {
        visual.avatarMesh.dispose(false, true);
      }
      visual.rootNode.dispose();
      visual = visuals.pop();
    }
    selectedIndex = null;
    selectedTarget = 'position';
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

    // Create offset area if random offset is enabled
    const offsetX = getOffsetRadius(spawnPoint.position.x);
    const offsetZ = getOffsetRadius(spawnPoint.position.z);
    let areaMesh: Mesh | null = null;
    if (offsetX > 0 || offsetZ > 0) {
      areaMesh = createOffsetArea(name, scene, rootNode, offsetX, offsetZ);
    }

    // Create camera target cube if camera target exists.
    // Parented to spawnPointsNode (not rootNode) so it stays in place during gizmo drag.
    let cameraTargetMesh: Mesh | null = null;
    if (spawnPoint.cameraTarget) {
      const targetPos = new Vector3(
        spawnPoint.cameraTarget.x,
        spawnPoint.cameraTarget.y,
        spawnPoint.cameraTarget.z,
      );
      cameraTargetMesh = createCameraTargetCube(name, scene, spawnPointsNode, targetPos);
    }

    return {
      index,
      rootNode,
      avatarMesh,
      areaMesh,
      cameraTargetMesh,
    };
  }

  /**
   * Updates visuals from scene component spawn points
   */
  function updateFromSceneComponent(spawnPoints: readonly SceneSpawnPoint[] | undefined): void {
    const points = spawnPoints || [];

    // Save selection state before clearing so we can restore it after rebuild
    const previousSelectedIndex = selectedIndex;
    const previousSelectedTarget = selectedTarget;

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

  /**
   * Selects a spawn point by index
   */
  function selectSpawnPoint(index: number | null): void {
    // Deselect previous (including camera target)
    if (selectedIndex !== null && selectedIndex < visuals.length) {
      const prevVisual = visuals[selectedIndex];
      if (prevVisual.avatarMesh) {
        setSpawnPointSelected(prevVisual.avatarMesh, false);
      }
      if (prevVisual.cameraTargetMesh) {
        setCameraTargetSelected(prevVisual.cameraTargetMesh, false);
      }
    }

    selectedIndex = index;
    selectedTarget = 'position';

    // Select new (avatar only, not camera target)
    if (index !== null && index < visuals.length) {
      const visual = visuals[index];
      if (visual.avatarMesh) {
        setSpawnPointSelected(visual.avatarMesh, true);
      }
    }

    events.emit('selectionChange', { index, target: 'position' });
  }

  /**
   * Selects the camera target of a spawn point by index
   */
  function selectCameraTarget(index: number): void {
    // Deselect previous (including camera target)
    if (selectedIndex !== null && selectedIndex < visuals.length) {
      const prevVisual = visuals[selectedIndex];
      if (prevVisual.avatarMesh) {
        setSpawnPointSelected(prevVisual.avatarMesh, false);
      }
      if (prevVisual.cameraTargetMesh) {
        setCameraTargetSelected(prevVisual.cameraTargetMesh, false);
      }
    }

    selectedIndex = index;
    selectedTarget = 'cameraTarget';

    // Select both avatar and camera target visuals
    if (index < visuals.length) {
      const visual = visuals[index];
      if (visual.avatarMesh) {
        setSpawnPointSelected(visual.avatarMesh, true);
      }
      if (visual.cameraTargetMesh) {
        setCameraTargetSelected(visual.cameraTargetMesh, true);
      }
    }

    events.emit('selectionChange', { index, target: 'cameraTarget' });
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
   * Gets the camera target mesh for a spawn point (for gizmo attachment)
   */
  function getCameraTargetNode(index: number): TransformNode | null {
    if (index < visuals.length) {
      return visuals[index].cameraTargetMesh;
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
   * Updates camera target position (called from gizmo drag)
   */
  function updateCameraTargetPosition(index: number, position: Vector3): void {
    if (index < visuals.length && visuals[index].cameraTargetMesh) {
      visuals[index].cameraTargetMesh!.position = position.clone();
      events.emit('cameraTargetPositionChange', { index, position: position.clone() });
    }
  }

  /**
   * Subscribes to events
   */
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
