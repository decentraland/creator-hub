import * as BABYLON from '@babylonjs/core';
import type { EcsEntity } from '../decentraland/EcsEntity';
import { keyState, Keys } from '../decentraland/keys';
import type { SceneContext } from '../decentraland/SceneContext';
import { boxSelectionManager } from '../decentraland/box-selection-manager';

export type BoxSelectionState = {
  isActive: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
};

export type BoxSelectionCallbacks = {
  onStart: (state: BoxSelectionState) => void;
  onUpdate: (state: BoxSelectionState) => void;
  onEnd: (state: BoxSelectionState) => void;
};

let boxSelectionState: BoxSelectionState = {
  isActive: false,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
};

let callbacks: BoxSelectionCallbacks | null = null;
let sceneContext: SceneContext | null = null;
let pointerObserver: BABYLON.Nullable<BABYLON.Observer<BABYLON.PointerInfo>> = null;

export function initBoxSelection(
  scene: BABYLON.Scene,
  context: SceneContext,
  selectionCallbacks: BoxSelectionCallbacks,
) {
  // Clean up any existing observer before creating a new one
  disposeBoxSelection(scene);

  callbacks = selectionCallbacks;
  sceneContext = context;

  // Listen for pointer events
  // Register with NO MASK to capture all pointer event types (down, move, up)
  // Register at the start of the observer list to process before other handlers
  pointerObserver = scene.onPointerObservable.add(
    e => {
      if (e.type === BABYLON.PointerEventTypes.POINTERDOWN) {
        const evt = e.event as PointerEvent;
        if (evt.button === 0) {
          // Left click only
          handlePointerDown(scene, evt.offsetX, evt.offsetY);
        }
      } else if (e.type === BABYLON.PointerEventTypes.POINTERMOVE) {
        const evt = e.event as PointerEvent;
        handlePointerMove(evt.offsetX, evt.offsetY);
      } else if (e.type === BABYLON.PointerEventTypes.POINTERUP) {
        const evt = e.event as PointerEvent;
        if (evt.button === 0) {
          handlePointerUp(scene, evt.offsetX, evt.offsetY);
        }
      }
    },
    undefined,
    true,
  ); // mask=undefined (all events), insertFirst=true (priority)
}

/**
 * Cleanup function to remove box selection event listeners
 * Should be called when component unmounts or scene changes
 */
export function disposeBoxSelection(scene: BABYLON.Scene) {
  if (pointerObserver) {
    scene.onPointerObservable.remove(pointerObserver);
    pointerObserver = null;
  }

  // Reset state
  boxSelectionState.isActive = false;
  callbacks = null;
  sceneContext = null;
}

function handlePointerDown(scene: BABYLON.Scene, x: number, y: number) {
  // Don't start box selection if holding Ctrl/Shift (used for multi-select) or Alt (used for camera rotation)
  if (keyState[Keys.KEY_CTRL] || keyState[Keys.KEY_SHIFT] || keyState[Keys.KEY_ALT]) {
    return;
  }

  // Check what we clicked on
  const pickingResult = scene.pick(x, y, void 0, false);
  const pickedMesh = pickingResult?.pickedMesh;

  // Don't start box selection if we clicked on a gizmo
  if (pickedMesh && pickedMesh.name && pickedMesh.name.toLowerCase().includes('gizmo')) {
    return;
  }

  // Don't start box selection if we clicked on a selected entity (allow gizmo manipulation)
  if (pickedMesh) {
    const entity = findParentEntity(pickedMesh);
    if (entity && sceneContext) {
      const { editorComponents } = sceneContext;
      if (editorComponents.Selection.has(entity.entityId)) {
        // Clicked on an already selected entity - don't start box selection
        return;
      }
    }
  }

  // Start box selection
  boxSelectionState = {
    isActive: true,
    startX: x,
    startY: y,
    currentX: x,
    currentY: y,
  };
  callbacks?.onStart(boxSelectionState);
}

function handlePointerMove(x: number, y: number) {
  if (boxSelectionState.isActive) {
    boxSelectionState.currentX = x;
    boxSelectionState.currentY = y;
    callbacks?.onUpdate(boxSelectionState);
  }
}

function handlePointerUp(scene: BABYLON.Scene, x: number, y: number) {
  if (boxSelectionState.isActive) {
    boxSelectionState.currentX = x;
    boxSelectionState.currentY = y;

    // Calculate selection box bounds
    const minX = Math.min(boxSelectionState.startX, boxSelectionState.currentX);
    const maxX = Math.max(boxSelectionState.startX, boxSelectionState.currentX);
    const minY = Math.min(boxSelectionState.startY, boxSelectionState.currentY);
    const maxY = Math.max(boxSelectionState.startY, boxSelectionState.currentY);

    // Only select if the box has a minimum size (avoid accidental tiny selections)
    const boxWidth = maxX - minX;
    const boxHeight = maxY - minY;

    if (boxWidth > 5 || boxHeight > 5) {
      // Get all entities within the selection box
      const selectedEntities = getEntitiesInBox(scene, minX, minY, maxX, maxY);

      // Select the entities
      if (sceneContext) {
        const { operations, engine } = sceneContext;

        if (selectedEntities.length > 0) {
          // Clear existing selection first using the operations API
          operations.removeSelectedEntities();

          // Select all entities in the box
          selectedEntities.forEach((entity, index) => {
            operations.updateSelectedEntity(entity.entityId, index > 0);
          });

          void operations.dispatch();
        } else {
          // No entities selected - clear existing selection and select the scene (RootEntity)
          operations.removeSelectedEntities();
          operations.updateSelectedEntity(engine.RootEntity, false);
          void operations.dispatch();
        }
      }
    } else if (sceneContext) {
      // Box is too small - treat as a click
      // Check what was clicked
      const pickingResult = scene.pick(
        boxSelectionState.startX,
        boxSelectionState.startY,
        void 0,
        false,
      );
      const pickedMesh = pickingResult?.pickedMesh;

      // Check if we clicked on an actual selectable entity (not ground, gizmo, skybox, locked, or empty space)
      const entity = pickedMesh ? findParentEntity(pickedMesh) : null;
      const isEnvironmentMesh =
        pickedMesh &&
        (pickedMesh.name.toLowerCase().includes('gizmo') ||
          pickedMesh.name.toLowerCase().includes('ground') ||
          pickedMesh.name.toLowerCase().includes('skybox') ||
          pickedMesh.name.toLowerCase().includes('hemi') ||
          pickedMesh.id.includes('BackgroundPlane') ||
          pickedMesh.id.includes('BackgroundSkybox'));

      // Treat locked, hidden, ground, and tile entities as non-selectable (like empty space)
      const isNonSelectable = entity && (entity.isLocked() || entity.isHidden());
      const isGroundOrTile =
        entity &&
        sceneContext &&
        (sceneContext.editorComponents.Ground.has(entity.entityId) ||
          sceneContext.editorComponents.Tile.has(entity.entityId));

      if (!entity || isEnvironmentMesh || isNonSelectable || isGroundOrTile) {
        // Clicked on empty space, ground, skybox, or gizmo - select the scene (RootEntity)
        const { operations, engine } = sceneContext;
        // Clear existing selection first
        operations.removeSelectedEntities();
        // Then select the scene
        operations.updateSelectedEntity(engine.RootEntity, false);
        void operations.dispatch();
      }
      // If clicked on an entity, do nothing (let the input.ts handler deal with it)
    }

    // Reset state FIRST
    boxSelectionState = {
      isActive: false,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
    };

    // Then notify with the reset state
    callbacks?.onEnd(boxSelectionState);
  }
}

/**
 * Check if an entity is visible from the camera using screen-space picking.
 * This method samples multiple points on the entity's screen-space bounding box
 * and uses scene.pick() to check if the actual mesh geometry is visible.
 *
 * This is more accurate than raycasting to bounding box corners, especially for
 * complex, thin, or curved meshes.
 */
function isEntityVisibleFromCamera(
  scene: BABYLON.Scene,
  camera: BABYLON.Camera,
  entity: EcsEntity,
  selectionBox: { minX: number; maxX: number; minY: number; maxY: number },
): boolean {
  const engine = scene.getEngine();
  const canvas = engine.getRenderingCanvas();
  if (!canvas) return false;

  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;

  // Get all child meshes of the entity
  const childMeshes = entity.getChildMeshes(false);
  if (childMeshes.length === 0) return false;

  // Build screen-space bounding box by projecting all vertices
  let screenMinX = Infinity;
  let screenMaxX = -Infinity;
  let screenMinY = Infinity;
  let screenMaxY = -Infinity;
  let hasValidProjection = false;

  for (const mesh of childMeshes) {
    if (!mesh.isVisible || mesh.name.startsWith('gizmo')) continue;

    // Get vertex positions
    const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    if (!positions) continue;

    const worldMatrix = mesh.getWorldMatrix();

    // Sample vertices (for performance, sample every Nth vertex for large meshes)
    const vertexCount = positions.length / 3;
    const sampleRate = vertexCount > 100 ? Math.ceil(vertexCount / 100) : 1;

    for (let i = 0; i < positions.length; i += 3 * sampleRate) {
      const localPos = new BABYLON.Vector3(positions[i], positions[i + 1], positions[i + 2]);
      const worldPos = BABYLON.Vector3.TransformCoordinates(localPos, worldMatrix);

      // Project to screen space
      const screenPos = BABYLON.Vector3.Project(
        worldPos,
        BABYLON.Matrix.Identity(),
        scene.getTransformMatrix(),
        camera.viewport,
      );

      // Check if point is in front of camera
      if (screenPos.z >= 0 && screenPos.z <= 1) {
        const screenX = screenPos.x * canvasWidth;
        const screenY = screenPos.y * canvasHeight;

        screenMinX = Math.min(screenMinX, screenX);
        screenMaxX = Math.max(screenMaxX, screenX);
        screenMinY = Math.min(screenMinY, screenY);
        screenMaxY = Math.max(screenMaxY, screenY);
        hasValidProjection = true;
      }
    }
  }

  if (!hasValidProjection) return false;

  // Check if screen-space bounding box overlaps with selection box
  const overlapsSelection =
    screenMinX <= selectionBox.maxX &&
    screenMaxX >= selectionBox.minX &&
    screenMinY <= selectionBox.maxY &&
    screenMaxY >= selectionBox.minY;

  if (!overlapsSelection) return false;

  // Find the overlap region
  const overlapMinX = Math.max(screenMinX, selectionBox.minX);
  const overlapMaxX = Math.min(screenMaxX, selectionBox.maxX);
  const overlapMinY = Math.max(screenMinY, selectionBox.minY);
  const overlapMaxY = Math.min(screenMaxY, selectionBox.maxY);

  // Sample points within the overlap region to verify actual mesh visibility
  // We'll test a grid of points (5x5 = 25 points, adjust for performance)
  const samplesPerAxis = 5;
  const stepX = (overlapMaxX - overlapMinX) / (samplesPerAxis - 1);
  const stepY = (overlapMaxY - overlapMinY) / (samplesPerAxis - 1);

  for (let ix = 0; ix < samplesPerAxis; ix++) {
    for (let iy = 0; iy < samplesPerAxis; iy++) {
      const testX = overlapMinX + ix * stepX;
      const testY = overlapMinY + iy * stepY;

      // Use scene.pick() to check if we hit this entity's mesh
      const pickResult = scene.pick(testX, testY, mesh => {
        // Only check visible meshes, not gizmos
        if (!mesh.isVisible || mesh.name.startsWith('gizmo')) return false;
        return true;
      });

      if (pickResult?.hit && pickResult.pickedMesh) {
        const pickedEntity = findParentEntity(pickResult.pickedMesh);
        if (pickedEntity === entity) {
          // We successfully picked this entity's mesh - it's visible!
          return true;
        }
      }
    }
  }

  // None of the sample points hit the entity's mesh - it's fully occluded
  return false;
}

function getEntitiesInBox(
  scene: BABYLON.Scene,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): EcsEntity[] {
  const selectedEntities: EcsEntity[] = [];
  const camera = scene.activeCamera;

  if (!camera) return selectedEntities;

  const engine = scene.getEngine();
  const canvas = engine.getRenderingCanvas();
  if (!canvas) return selectedEntities;

  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;

  // Check if "Select Through" is enabled
  const selectThroughEnabled = boxSelectionManager.isSelectThroughEnabled();

  // Get all meshes in the scene
  const allMeshes = scene.meshes;

  for (const mesh of allMeshes) {
    // Skip invisible meshes and gizmos
    if (!mesh.isVisible || mesh.name.startsWith('gizmo')) {
      continue;
    }

    // Try to find the parent DCL entity
    const entity = findParentEntity(mesh);
    if (!entity || entity.isLocked() || entity.isHidden()) {
      continue;
    }

    // Check if already added
    if (selectedEntities.includes(entity)) {
      continue;
    }

    // Get the entity's world position
    const worldPosition = entity.getAbsolutePosition();

    // Project 3D position to 2D screen space
    // Using identity matrix for world matrix since we already have world position
    const screenPosition = BABYLON.Vector3.Project(
      worldPosition,
      BABYLON.Matrix.Identity(),
      scene.getTransformMatrix(),
      camera.viewport,
    );

    // Convert from normalized coordinates (0-1) to pixel coordinates
    const screenX = screenPosition.x * canvasWidth;
    const screenY = screenPosition.y * canvasHeight;

    // Check if the projected position is within the selection box
    // Also check that the point is in front of the camera (z >= 0 and <= 1)
    if (
      screenPosition.z >= 0 &&
      screenPosition.z <= 1 &&
      screenX >= minX &&
      screenX <= maxX &&
      screenY >= minY &&
      screenY <= maxY
    ) {
      // If "Select Through" is disabled, perform occlusion test using screen-space picking
      if (!selectThroughEnabled) {
        if (!isEntityVisibleFromCamera(scene, camera, entity, { minX, maxX, minY, maxY })) {
          continue; // Entity is occluded, skip it
        }
      }

      selectedEntities.push(entity);
    }
  }

  return selectedEntities;
}

function isEcsEntity(x: any): x is EcsEntity {
  return 'isDCLEntity' in x;
}

function findParentEntity<T extends BABYLON.Node & { isDCLEntity?: boolean }>(
  node: T,
): EcsEntity | null {
  // Find the next entity parent to dispatch the event
  let parent: BABYLON.Node | null = node.parent;

  while (parent && !isEcsEntity(parent)) {
    parent = parent.parent;

    // If the element has no parent, stop execution
    if (!parent) return null;
  }

  return (parent as any) || null;
}

export function getBoxSelectionState(): BoxSelectionState {
  return boxSelectionState;
}
