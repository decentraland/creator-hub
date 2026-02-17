import * as BABYLON from '@babylonjs/core';

import type { EcsEntity } from '../decentraland/EcsEntity';
import { snapManager } from '../decentraland/snap-manager';
import { keyState, Keys } from '../decentraland/keys';
import { getAncestors, isAncestor, mapNodes } from '../../sdk/nodes';
import { createSpawnPointManager } from '../decentraland/spawn-point-manager';

let isSnapEnabled = snapManager.isEnabled();
let isShiftKeyDown = false;
let clickStartTimer: ReturnType<typeof setTimeout>;
let isDragging = false;

export function initKeyboard(canvas: HTMLCanvasElement, scene: BABYLON.Scene) {
  canvas.addEventListener('keydown', e => {
    keyState[Keys.KEY_SHIFT] = e.shiftKey;
    keyState[Keys.KEY_CTRL] = e.ctrlKey;
    keyState[Keys.KEY_ALT] = e.altKey;
    keyState[e.keyCode] = true;
    if (e.shiftKey) {
      isSnapEnabled = snapManager.toggle();
      isShiftKeyDown = true;
    }
  });

  canvas.addEventListener('keyup', e => {
    if (isShiftKeyDown) {
      snapManager.setEnabled(!isSnapEnabled);
      isShiftKeyDown = false;
    }

    keyState[Keys.KEY_SHIFT] = e.shiftKey;
    keyState[Keys.KEY_CTRL] = e.ctrlKey;
    keyState[Keys.KEY_ALT] = e.altKey;
    keyState[e.keyCode] = false;
  });

  // When the canvas lost the focus, clear the special keys state
  canvas.addEventListener('blur', () => {
    keyState[Keys.KEY_SHIFT] = false;
    keyState[Keys.KEY_CTRL] = false;
    keyState[Keys.KEY_ALT] = false;
  });

  // Event to store the ctrlKey when the canvas has lost the focus
  canvas.addEventListener('contextmenu', e => {
    keyState[Keys.KEY_CTRL] = e.ctrlKey;
  });

  scene.onPointerObservable.add(e => {
    if (e.type === BABYLON.PointerEventTypes.POINTERDOWN) {
      const evt = e.event as PointerEvent;
      scene.getEngine().getRenderingCanvas()!.focus();
      if (evt.button === 0)
        interactWithScene(scene, 'pointerDown', evt.offsetX, evt.offsetY, evt.pointerId);
    } else if (e.type === BABYLON.PointerEventTypes.POINTERUP) {
      const evt = e.event as PointerEvent;
      if (evt.button === 0)
        interactWithScene(scene, 'pointerUp', evt.offsetX, evt.offsetY, evt.pointerId);
    }
  });
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

function getSceneContext(scene: BABYLON.Scene) {
  const ecsEntity = scene.transformNodes.find(n => isEcsEntity(n));
  return ecsEntity ? ecsEntity.context.deref()! : null;
}

function startDragDetection(): void {
  clickStartTimer = setTimeout(() => {
    isDragging = true;
  }, 150);
}

function resetDragDetection(): void {
  clearTimeout(clickStartTimer);
  isDragging = false;
}

export function interactWithScene(
  scene: BABYLON.Scene,
  pointerEvent: 'pointerUp' | 'pointerDown',
  x: number,
  y: number,
  _pointerId: number,
) {
  const pickingResult = scene.pick(x, y, void 0, false);

  const mesh = pickingResult!.pickedMesh;

  // Check if clicked on a spawn point mesh BEFORE checking for entities
  const spawnPointManager = createSpawnPointManager(scene);
  if (mesh && spawnPointManager.isMeshSpawnPoint(mesh)) {
    if (pointerEvent === 'pointerDown') {
      startDragDetection();
    } else if (pointerEvent === 'pointerUp') {
      if (!isDragging) {
        const spawnPointIndex = spawnPointManager.findSpawnPointByMesh(mesh);
        if (spawnPointIndex !== null) {
          const context = getSceneContext(scene);
          if (context) {
            const isCameraTarget = spawnPointManager.isMeshCameraTarget(mesh);
            if (isCameraTarget) {
              spawnPointManager.selectCameraTarget(spawnPointIndex);
            } else {
              spawnPointManager.selectSpawnPoint(spawnPointIndex);
            }

            // Select the Player entity to show spawn settings in inspector
            context.operations.updateSelectedEntity(context.engine.PlayerEntity);
            // Attach gizmo after dispatch so ECS processing (entity deselection/selection)
            // completes first and doesn't overwrite the spawn point gizmo
            void context.operations.dispatch().then(() => {
              const node = isCameraTarget
                ? spawnPointManager.getCameraTargetNode(spawnPointIndex)
                : spawnPointManager.getSpawnPointNode(spawnPointIndex);
              if (node) {
                const field = isCameraTarget ? 'cameraTarget' : 'position';
                context.gizmos.attachToSpawnPoint(node, spawnPointIndex, (i, position) => {
                  if (field === 'position') {
                    spawnPointManager.updateSpawnPointPosition(i, position);
                  } else {
                    spawnPointManager.updateCameraTargetPosition(i, position);
                  }
                });
              }
            });
          }
        }
      }
      resetDragDetection();
    }
    return; // Don't process entity selection
  }

  const entity = mesh && findParentEntity(mesh);

  if (entity && pointerEvent === 'pointerDown') {
    startDragDetection();
  } else if (
    entity &&
    pointerEvent === 'pointerUp' &&
    !isDragging &&
    !entity.isLocked() &&
    !entity.isHidden()
  ) {
    const context = entity.context.deref()!;
    const { operations, engine, editorComponents } = context;
    const ancestors = getAncestors(engine, entity.entityId);
    const nodes = mapNodes(engine, node =>
      isAncestor(ancestors, node.entity) ? { ...node, open: true } : node,
    );
    operations.updateValue(editorComponents.Nodes, engine.RootEntity, { value: nodes });
    operations.updateSelectedEntity(
      entity.entityId,
      !!keyState[Keys.KEY_CTRL] || !!keyState[Keys.KEY_SHIFT],
    );
    // Deselect any spawn point when selecting an entity
    spawnPointManager.selectSpawnPoint(null);
    void operations.dispatch();
  } else if (!entity && pointerEvent === 'pointerUp' && !isDragging) {
    // Clicked on sky or grid ground - un-select all previous entities
    const context = getSceneContext(scene);
    if (context) {
      context.operations.updateSelectedEntity(context.engine.RootEntity);
      spawnPointManager.selectSpawnPoint(null);
      void context.operations.dispatch();
    }
  }

  // Clear drag state on every pointerUp
  if (pointerEvent === 'pointerUp') {
    resetDragDetection();
  }
}
