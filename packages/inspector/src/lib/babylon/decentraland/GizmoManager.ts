import mitt from 'mitt';
import {
  GizmoManager as BabylonGizmoManager,
  Vector3,
  TransformNode,
  Quaternion,
} from '@babylonjs/core';
import { Vector3 as DclVector3 } from '@dcl/ecs-math';
import { GizmoType } from '../../utils/gizmo';
import type { SceneContext } from './SceneContext';
import type { EcsEntity } from './EcsEntity';
import { GizmoType as TransformerType } from './gizmos/types';
import type { IGizmoTransformer } from './gizmos';
import { FreeGizmo, PositionGizmo, RotationGizmo, ScaleGizmo } from './gizmos';
import { snapManager, snapPosition, snapRotation, snapScale } from './snap-manager';
import { getLayoutManager } from './layout-manager';

export function createGizmoManager(context: SceneContext) {
  // events
  const events = mitt<{ change: void }>();

  // Initialize state
  let selectedEntities: EcsEntity[] = [];
  let isEnabled = true;
  let currentTransformer: IGizmoTransformer | null = null;
  let isUpdatingFromGizmo = false;

  // Spawn point gizmo state
  let attachedSpawnPointIndex: number | null = null;
  let attachedSpawnPointTarget: 'position' | 'cameraTarget' = 'position';
  let onSpawnPointPositionChange: ((index: number, position: Vector3) => void) | null = null;
  let spawnPointDragStartPosition: Vector3 | null = null;
  let spawnPointAllowedAxes: Set<'x' | 'y' | 'z'> | null = null;
  const spawnPointSubGizmoObservers: Array<() => void> = [];

  function cleanupSubGizmoObservers(): void {
    for (const cleanup of spawnPointSubGizmoObservers) cleanup();
    spawnPointSubGizmoObservers.length = 0;
  }

  // Create and initialize Babylon.js gizmo manager
  const gizmoManager = new BabylonGizmoManager(context.scene);
  gizmoManager.usePointerToAttachGizmos = false;

  // Create transformers
  const positionTransformer = new PositionGizmo(gizmoManager, snapPosition);
  const rotationTransformer = new RotationGizmo(gizmoManager, snapRotation);
  const scaleTransformer = new ScaleGizmo(gizmoManager, snapScale, () => {
    if (selectedEntities.length === 0) return false;
    // If any selected entity has proportional scaling locked, force uniform scale for all
    return selectedEntities.some(
      e => !!context.editorComponents.TransformConfig.getOrNull(e.entityId)?.porportionalScaling,
    );
  });
  const freeTransformer = new FreeGizmo(context.scene);

  // Add alignment state
  let isGizmoWorldAligned = true;
  const isGizmoWorldAlignmentDisabled = false;

  // Helper function to get world rotation of an entity
  function getWorldRotation(entity: EcsEntity): Quaternion {
    if (!entity.rotationQuaternion) return Quaternion.Identity();

    if (!entity.parent || !(entity.parent instanceof TransformNode)) {
      return entity.rotationQuaternion.clone();
    }

    const parent = entity.parent as TransformNode;
    const parentWorldRotation =
      parent.rotationQuaternion || Quaternion.FromRotationMatrix(parent.getWorldMatrix());
    const entityLocalRotation = entity.rotationQuaternion || Quaternion.Identity();

    return parentWorldRotation.multiply(entityLocalRotation);
  }

  // Helper function to sync gizmo rotation
  function syncGizmoRotation(
    gizmoNode: TransformNode,
    entities: EcsEntity[],
    isWorldAligned: boolean,
  ): void {
    if (entities.length === 0) return;

    const useLocalRotation =
      !isWorldAligned &&
      entities.length === 1 &&
      entities[0].rotationQuaternion &&
      gizmoNode.rotationQuaternion;

    if (useLocalRotation) {
      // Local aligned: sync with the first entity's rotation (if single entity)
      const worldRotation = getWorldRotation(entities[0]);
      gizmoNode.rotationQuaternion!.copyFrom(worldRotation);
    } else if (gizmoNode.rotationQuaternion) {
      // World aligned or multiple entities: reset to identity rotation
      gizmoNode.rotationQuaternion.set(0, 0, 0, 1);
    }

    gizmoNode.computeWorldMatrix(true);
  }

  function updateEntityPosition(entity: EcsEntity) {
    const currentTransform = context.Transform.getOrNull(entity.entityId);
    if (!currentTransform) return;

    isUpdatingFromGizmo = true;
    context.operations.updateValue(context.Transform, entity.entityId, {
      ...currentTransform,
      position: DclVector3.create(entity.position.x, entity.position.y, entity.position.z),
    });
  }

  function updateEntityRotation(entity: EcsEntity) {
    const currentTransform = context.Transform.getOrNull(entity.entityId);
    if (!currentTransform || !entity.rotationQuaternion) return;

    isUpdatingFromGizmo = true;
    // The RotationGizmo already applies the rotation in local coordinates
    // We only need to use the Babylon rotation directly
    const { x, y, z, w } = entity.rotationQuaternion;
    context.operations.updateValue(context.Transform, entity.entityId, {
      ...currentTransform,
      rotation: { x, y, z, w },
    });
  }

  function updateEntityScale(entity: EcsEntity) {
    const currentTransform = context.Transform.getOrNull(entity.entityId);
    if (!currentTransform) return;

    isUpdatingFromGizmo = true;
    context.operations.updateValue(context.Transform, entity.entityId, {
      ...currentTransform,
      scale: DclVector3.create(entity.scaling.x, entity.scaling.y, entity.scaling.z),
      position: DclVector3.create(entity.position.x, entity.position.y, entity.position.z),
    });
  }

  // Calculate centroid of selected entities
  function calculateCentroid(): Vector3 {
    if (selectedEntities.length === 0) return Vector3.Zero();

    const sum = selectedEntities.reduce((acc, entity) => {
      const worldPosition = entity.getAbsolutePosition();
      return acc.add(worldPosition);
    }, Vector3.Zero());

    return sum.scale(1 / selectedEntities.length);
  }

  // Helper function to get or create gizmo node
  function getGizmoNode(): TransformNode {
    let node = context.scene.getTransformNodeByName('GIZMO_NODE');
    if (!node) {
      node = new TransformNode('GIZMO_NODE', context.scene);
      node.rotationQuaternion = Quaternion.Identity();
    } else if (!node.rotationQuaternion) {
      node.rotationQuaternion = Quaternion.Identity();
    }
    return node;
  }

  // Update gizmo position to centroid
  function updateGizmoPosition() {
    if (selectedEntities.length === 0) {
      gizmoManager.attachToNode(null);
      return;
    }

    const node = getGizmoNode();
    const centroid = calculateCentroid();
    node.position = centroid;

    // Preserve rotation when switching between gizmos
    if (!node.rotationQuaternion) {
      node.rotationQuaternion = Quaternion.Identity();
    }
    // Don't reset rotation if it already exists - let the gizmo transformers handle rotation

    node.computeWorldMatrix(true);
    gizmoManager.attachToNode(node);
  }

  // Update gizmo position and rotation based on current transformer type
  function updateGizmoTransform() {
    if (selectedEntities.length === 0) {
      gizmoManager.attachToNode(null);
      return;
    }

    const node = getGizmoNode();
    const centroid = calculateCentroid();
    node.position = centroid;

    // Preserve rotation when switching between gizmos
    if (!node.rotationQuaternion) {
      node.rotationQuaternion = Quaternion.Identity();
    }

    if (currentTransformer) {
      if (currentTransformer.type === TransformerType.ROTATION) {
        // Update rotation based on current transformer type
        syncGizmoRotation(node, selectedEntities, isGizmoWorldAligned);
      } else if (currentTransformer.type === TransformerType.FREE) {
        // Update free gizmo indicator with ECS updates
        (currentTransformer as FreeGizmo).updateGizmoIndicator();
      }
      // For non-rotation gizmos, let the transformers handle rotation
      // Don't reset rotation if it already exists
    }

    node.computeWorldMatrix(true);
    gizmoManager.attachToNode(node);
  }

  // Parent-child relationship handling
  function restoreParents() {
    selectedEntities.forEach(entity => {
      const currentTransform = context.Transform.getOrNull(entity.entityId);
      if (currentTransform) {
        const parent = currentTransform.parent
          ? context.getEntityOrNull(currentTransform.parent)
          : null;
        entity.setParent(parent);
      }
    });
  }

  function setupTransformListeners() {
    selectedEntities.forEach(entity => {
      context.Transform.onChange(entity.entityId, _value => {
        if (!isUpdatingFromGizmo && selectedEntities.some(e => e.entityId === entity.entityId)) {
          setTimeout(() => updateGizmoTransform(), 0);
        }
      });
    });
  }

  /** Common setup shared across all gizmo type activations */
  function activateTransformer(transformer: IGizmoTransformer, snapValue: number): void {
    currentTransformer = transformer;
    transformer.setup();
    transformer.setEntities(selectedEntities);

    if ('setWorldAligned' in transformer) {
      transformer.setWorldAligned(isGizmoWorldAligned);
    }

    if ('enable' in transformer) {
      transformer.enable();
    }

    if ('setSnapDistance' in transformer) {
      transformer.setSnapDistance(snapManager.isEnabled() ? snapValue : 0);
    }
  }

  function dispatchAndClearFlag(): void {
    void context.operations.dispatch();
    isUpdatingFromGizmo = false;
  }

  function updateSnap() {
    if (currentTransformer && 'setSnapDistance' in currentTransformer) {
      if (gizmoManager.rotationGizmoEnabled) {
        currentTransformer.setSnapDistance(
          snapManager.isEnabled() ? snapManager.getRotationSnap() : 0,
        );
      } else if (gizmoManager.scaleGizmoEnabled) {
        currentTransformer.setSnapDistance(
          snapManager.isEnabled() ? snapManager.getScaleSnap() : 0,
        );
      } else {
        currentTransformer.setSnapDistance(
          snapManager.isEnabled() ? snapManager.getPositionSnap() : 0,
        );
      }
    }
  }
  snapManager.onChange(updateSnap);

  return {
    gizmoManager,
    isEnabled() {
      return isEnabled;
    },
    setEnabled(value: boolean) {
      isEnabled = value;
      if (!isEnabled) {
        gizmoManager.attachToNode(null);
      }
    },
    restoreParents,
    addEntity(entity: EcsEntity) {
      if (selectedEntities.includes(entity) || !isEnabled) return;
      selectedEntities.push(entity);
      updateGizmoPosition();
      setupTransformListeners();
      // Update current transformer with new entities
      if (currentTransformer) {
        currentTransformer.setEntities(selectedEntities);
      }
      events.emit('change');
    },
    getEntity() {
      return selectedEntities[0];
    },
    removeEntity(entity: EcsEntity) {
      selectedEntities = selectedEntities.filter(e => e.entityId !== entity.entityId);
      if (selectedEntities.length === 0 && attachedSpawnPointIndex === null) {
        gizmoManager.attachToNode(null);
        // Clean up if transformer is scale, needed for disposing custom plane meshes
        if (currentTransformer && currentTransformer.type === TransformerType.SCALE) {
          currentTransformer.cleanup();
        }
      } else if (selectedEntities.length > 0) {
        updateGizmoPosition();
      }

      // Update current transformer with remaining entities
      if (currentTransformer) {
        currentTransformer.setEntities(selectedEntities);
      }
    },
    getGizmoTypes() {
      return [GizmoType.FREE, GizmoType.POSITION, GizmoType.ROTATION, GizmoType.SCALE] as const;
    },
    setGizmoType(type: GizmoType) {
      // Then disable all Babylon gizmos
      gizmoManager.positionGizmoEnabled = false;
      gizmoManager.rotationGizmoEnabled = false;
      gizmoManager.scaleGizmoEnabled = false;

      // Clean up current transformer if any
      if (currentTransformer) {
        currentTransformer.cleanup();
        currentTransformer = null;
      }

      // Setup the new transformer based on type
      switch (type) {
        case GizmoType.POSITION: {
          activateTransformer(positionTransformer, snapManager.getPositionSnap());
          // Set up callbacks for ECS updates
          if ('setUpdateCallbacks' in positionTransformer) {
            positionTransformer.setUpdateCallbacks(updateEntityPosition, dispatchAndClearFlag);
          }
          gizmoManager.positionGizmoEnabled = true;
          break;
        }
        case GizmoType.ROTATION: {
          activateTransformer(rotationTransformer, snapManager.getRotationSnap());
          // Set up callbacks for ECS updates
          if ('setUpdateCallbacks' in rotationTransformer) {
            rotationTransformer.setUpdateCallbacks(
              updateEntityRotation,
              updateEntityPosition,
              dispatchAndClearFlag,
              context,
            );
          }
          gizmoManager.rotationGizmoEnabled = true;
          break;
        }
        case GizmoType.SCALE: {
          activateTransformer(scaleTransformer, snapManager.getScaleSnap());
          // Set up callbacks for ECS updates
          if ('setUpdateCallbacks' in scaleTransformer) {
            scaleTransformer.setUpdateCallbacks(updateEntityScale, dispatchAndClearFlag);
          }
          gizmoManager.scaleGizmoEnabled = true;
          break;
        }
        case GizmoType.FREE: {
          activateTransformer(freeTransformer, snapManager.getPositionSnap());

          // Pass GizmoManager reference to FreeGizmo for centroid calculation
          if ('setGizmoManager' in freeTransformer) {
            (freeTransformer as any).setGizmoManager(calculateCentroid);
          }
          // Set up callbacks for ECS updates
          if ('setUpdateCallbacks' in freeTransformer) {
            freeTransformer.setUpdateCallbacks(updateEntityPosition, dispatchAndClearFlag);
          }
          // Set up callback to update gizmo position after drag ends
          if ('setOnDragEndCallback' in freeTransformer) {
            freeTransformer.setOnDragEndCallback?.(() => updateGizmoPosition());
          }
          break;
        }
      }
      events.emit('change');
    },
    isGizmoWorldAligned() {
      return isGizmoWorldAligned;
    },
    setGizmoWorldAligned(value: boolean) {
      isGizmoWorldAligned = value;
      if (currentTransformer && 'setWorldAligned' in currentTransformer) {
        currentTransformer.setWorldAligned(value);
      }
      events.emit('change');
    },
    isGizmoWorldAlignmentDisabled() {
      return isGizmoWorldAlignmentDisabled;
    },
    onChange(cb: () => void) {
      events.on('change', cb);
      return () => {
        events.off('change', cb);
      };
    },
    forceUpdateGizmo() {
      if (selectedEntities.length > 0) {
        updateGizmoTransform();
      }
    },
    /**
     * Attaches the position gizmo to a spawn point transform node
     */
    attachToSpawnPoint(
      spawnPointNode: TransformNode,
      spawnPointIndex: number,
      onPositionChange: (index: number, position: Vector3) => void,
      target: 'position' | 'cameraTarget' = 'position',
    ) {
      // Detach from any entities first, restoring parent relationships
      if (selectedEntities.length > 0) {
        restoreParents();
        selectedEntities = [];
      }

      // Store spawn point state
      attachedSpawnPointIndex = spawnPointIndex;
      attachedSpawnPointTarget = target;
      onSpawnPointPositionChange = onPositionChange;
      spawnPointDragStartPosition = null;
      spawnPointAllowedAxes = null;

      // Clean up previous sub-gizmo observers
      cleanupSubGizmoObservers();

      gizmoManager.positionGizmoEnabled = false;
      gizmoManager.rotationGizmoEnabled = false;
      gizmoManager.scaleGizmoEnabled = false;

      if (currentTransformer) {
        currentTransformer.cleanup();
        currentTransformer = null;
      }

      currentTransformer = positionTransformer;
      currentTransformer.setup();
      currentTransformer.setEntities([]);

      // Emit position change filtered to only the axes affected by the active sub-gizmo.
      // Babylon's planar gizmo can leak movement into the plane-normal axis due to world matrix
      // decomposition, so we record which axes are allowed at drag start and mask the rest.
      if ('setUpdateCallbacks' in currentTransformer) {
        const emitPositionChange = () => {
          if (attachedSpawnPointIndex !== null && onSpawnPointPositionChange) {
            if (spawnPointNode.isDisposed()) return;
            const rawPosition = spawnPointNode.position.clone();
            // Filter position: keep only the axes that should change, restore the rest
            if (spawnPointDragStartPosition && spawnPointAllowedAxes) {
              if (!spawnPointAllowedAxes.has('x')) rawPosition.x = spawnPointDragStartPosition.x;
              if (!spawnPointAllowedAxes.has('y')) rawPosition.y = spawnPointDragStartPosition.y;
              if (!spawnPointAllowedAxes.has('z')) rawPosition.z = spawnPointDragStartPosition.z;
              // Also fix the node position to match the filtered result
              spawnPointNode.position.copyFrom(rawPosition);
            }
            onSpawnPointPositionChange(attachedSpawnPointIndex, rawPosition);
          }
        };
        currentTransformer.setUpdateCallbacks(emitPositionChange, emitPositionChange);
      }

      // Force world aligned for spawn points
      if ('setWorldAligned' in currentTransformer) {
        currentTransformer.setWorldAligned(true);
      }

      gizmoManager.positionGizmoEnabled = true;

      if ('enable' in currentTransformer) {
        currentTransformer.enable();
      }

      if ('setSnapDistance' in currentTransformer) {
        currentTransformer.setSnapDistance(
          snapManager.isEnabled() ? snapManager.getPositionSnap() : 0,
        );
      }

      // Subscribe to individual sub-gizmo drag starts to track which axes should change.
      // Each sub-gizmo constrains movement to specific axes:
      //   axis gizmos: single axis  |  planar gizmos: two axes (plane normal is locked)
      const positionGizmo = gizmoManager.gizmos.positionGizmo;
      if (positionGizmo) {
        type AxesSet = Set<'x' | 'y' | 'z'>;
        // Use `any` because Babylon's IAxisDragGizmo/IPlaneDragGizmo interfaces don't
        // expose onDragStartObservable in their public type, but the concrete classes do.
        const subGizmoAxes: Array<{ gizmo: any; axes: AxesSet }> = [
          { gizmo: positionGizmo.xGizmo, axes: new Set(['x']) },
          { gizmo: positionGizmo.yGizmo, axes: new Set(['y']) },
          { gizmo: positionGizmo.zGizmo, axes: new Set(['z']) },
          { gizmo: positionGizmo.xPlaneGizmo, axes: new Set(['y', 'z']) },
          { gizmo: positionGizmo.yPlaneGizmo, axes: new Set(['x', 'z']) },
          { gizmo: positionGizmo.zPlaneGizmo, axes: new Set(['x', 'y']) },
        ];

        for (const { gizmo, axes } of subGizmoAxes) {
          // The onDragStartObservable lives on the dragBehavior, not the gizmo itself
          const observable = gizmo?.dragBehavior?.onDragStartObservable;
          if (!observable) continue;
          const observer = observable.add(() => {
            spawnPointDragStartPosition = spawnPointNode.position.clone();
            spawnPointAllowedAxes = axes;
          });
          spawnPointSubGizmoObservers.push(() => {
            observable.remove(observer);
          });
        }

        // Show orange boundary indicator during drag when any part of the node exits bounds
        const layoutMgr = getLayoutManager(context.scene);
        const dragObserver = positionGizmo.onDragObservable.add(() => {
          if (spawnPointNode.isDisposed()) return;
          const pos = spawnPointNode.position;
          if (target === 'cameraTarget') {
            const isOutside = !layoutMgr.isPositionInBounds(pos);
            context.spawnPoints.setCameraTargetOutOfBoundsVisible(spawnPointIndex, isOutside);
          } else {
            const extents = context.spawnPoints.getSpawnAreaHalfExtents(spawnPointIndex);
            const ex = extents?.x ?? 0;
            const ez = extents?.z ?? 0;
            const isOutside =
              !layoutMgr.isPositionInBounds(new Vector3(pos.x - ex, pos.y, pos.z - ez)) ||
              !layoutMgr.isPositionInBounds(new Vector3(pos.x + ex, pos.y, pos.z - ez)) ||
              !layoutMgr.isPositionInBounds(new Vector3(pos.x - ex, pos.y, pos.z + ez)) ||
              !layoutMgr.isPositionInBounds(new Vector3(pos.x + ex, pos.y, pos.z + ez));
            context.spawnPoints.setSpawnPointOutOfBoundsVisible(spawnPointIndex, isOutside);
          }
        });
        const dragEndObserver = positionGizmo.onDragEndObservable.add(() => {
          if (target === 'cameraTarget') {
            context.spawnPoints.setCameraTargetOutOfBoundsVisible(spawnPointIndex, false);
          } else {
            context.spawnPoints.setSpawnPointOutOfBoundsVisible(spawnPointIndex, false);
          }
        });
        spawnPointSubGizmoObservers.push(() => {
          positionGizmo.onDragObservable.remove(dragObserver);
          positionGizmo.onDragEndObservable.remove(dragEndObserver);
        });
      }

      gizmoManager.attachToNode(spawnPointNode);
      events.emit('change');
    },
    detachFromSpawnPoint() {
      if (attachedSpawnPointIndex === null) return;

      if (attachedSpawnPointTarget === 'cameraTarget') {
        context.spawnPoints.setCameraTargetOutOfBoundsVisible(attachedSpawnPointIndex, false);
      } else {
        context.spawnPoints.setSpawnPointOutOfBoundsVisible(attachedSpawnPointIndex, false);
      }

      attachedSpawnPointIndex = null;
      attachedSpawnPointTarget = 'position';
      onSpawnPointPositionChange = null;
      spawnPointDragStartPosition = null;
      spawnPointAllowedAxes = null;

      cleanupSubGizmoObservers();

      if (currentTransformer) {
        currentTransformer.cleanup();
        currentTransformer = null;
      }

      gizmoManager.positionGizmoEnabled = false;
      gizmoManager.attachToNode(null);
      events.emit('change');
    },
    isAttachedToSpawnPoint() {
      return attachedSpawnPointIndex !== null;
    },
  };
}

export type Gizmos = ReturnType<typeof createGizmoManager>;
