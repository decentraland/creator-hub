import type { GizmoManager } from '@babylonjs/core';
import { Vector3, TransformNode, Quaternion } from '@babylonjs/core';
import type { Entity } from '@dcl/ecs';
import type { EcsEntity } from '../EcsEntity';
import { LEFT_BUTTON } from '../mouse-utils';
import type { IGizmoTransformer } from './types';
import { GizmoType } from './types';
import { configureGizmoButtons } from './utils';

interface EntityState {
  position: Vector3;
  scale: Vector3;
  rotation: Quaternion;
  offset: Vector3;
}

export class PositionGizmo implements IGizmoTransformer {
  type = GizmoType.POSITION;
  private entityStates = new Map<Entity, EntityState>();
  private pivotPosition: Vector3 | null = null;
  private isDragging = false;
  private currentEntities: EcsEntity[] = [];
  private updateEntityPosition: ((entity: EcsEntity) => void) | null = null;
  private dispatchOperations: (() => void) | null = null;
  private isWorldAligned = true;
  private repositionAttempts = 0;
  private maxRepositionAttempts = 60; // Try for about 1 second (60 frames)
  private renderObserver: any = null;

  private dragStartObserver: any = null;
  private dragObserver: any = null;
  private dragEndObserver: any = null;

  constructor(
    private gizmoManager: GizmoManager,
    private snapPosition: (position: Vector3) => Vector3,
  ) {}

  setup(): void {
    const positionGizmo = this.getPositionGizmo();
    if (!positionGizmo) return;

    positionGizmo.updateGizmoRotationToMatchAttachedMesh = !this.isWorldAligned;

    // Make the entire gizmo 20% bigger
    positionGizmo.scaleRatio = 1.2;

    // Enable planar gizmos (the panels between axes for 2D movement)
    positionGizmo.planarGizmoEnabled = true;

    // Configure plane gizmos for better visibility and positioning
    const planeScale = 0.375; // 25% bigger (0.3 * 1.25)

    if (positionGizmo.xPlaneGizmo) {
      positionGizmo.xPlaneGizmo.isEnabled = true;
      positionGizmo.xPlaneGizmo.snapDistance = 0; // Will be set by setSnapDistance
      positionGizmo.xPlaneGizmo.scaleRatio = planeScale;
    }
    if (positionGizmo.yPlaneGizmo) {
      positionGizmo.yPlaneGizmo.isEnabled = true;
      positionGizmo.yPlaneGizmo.snapDistance = 0;
      positionGizmo.yPlaneGizmo.scaleRatio = planeScale;
    }
    if (positionGizmo.zPlaneGizmo) {
      positionGizmo.zPlaneGizmo.isEnabled = true;
      positionGizmo.zPlaneGizmo.snapDistance = 0;
      positionGizmo.zPlaneGizmo.scaleRatio = planeScale;
    }
  }

  private repositionPlanarGizmos(): void {
    const positionGizmo = this.getPositionGizmo();
    if (!positionGizmo) return;

    const offset = 0.25;
    const planeScale = 0.375; // 25% bigger (0.3 * 1.25)
    let allMeshesFound = true;

    // Force re-apply scale ratio and reposition each planar gizmo
    if (positionGizmo.xPlaneGizmo) {
      positionGizmo.xPlaneGizmo.scaleRatio = planeScale;
      const gizmo = positionGizmo.xPlaneGizmo as any;
      const mesh = gizmo._gizmoMesh || gizmo._rootMesh;
      if (mesh && mesh.position) {
        mesh.position.y = offset;
        mesh.position.z = offset;
      } else {
        allMeshesFound = false;
      }
    }

    if (positionGizmo.yPlaneGizmo) {
      positionGizmo.yPlaneGizmo.scaleRatio = planeScale;
      const gizmo = positionGizmo.yPlaneGizmo as any;
      const mesh = gizmo._gizmoMesh || gizmo._rootMesh;
      if (mesh && mesh.position) {
        mesh.position.x = offset;
        mesh.position.z = offset;
      } else {
        allMeshesFound = false;
      }
    }

    if (positionGizmo.zPlaneGizmo) {
      positionGizmo.zPlaneGizmo.scaleRatio = planeScale;
      const gizmo = positionGizmo.zPlaneGizmo as any;
      const mesh = gizmo._gizmoMesh || gizmo._rootMesh;
      if (mesh && mesh.position) {
        mesh.position.x = offset;
        mesh.position.y = offset;
      } else {
        allMeshesFound = false;
      }
    }

    if (allMeshesFound && this.renderObserver) {
      this.stopRepositionObserver();
    }
  }

  private startRepositionObserver(): void {
    // Clean up any existing observer
    this.stopRepositionObserver();

    // Reset attempt counter
    this.repositionAttempts = 0;

    // Get the scene from the gizmo manager
    const scene = this.gizmoManager.gizmos.positionGizmo?._rootMesh?.getScene();
    if (!scene) return;

    // Set up a render observer that tries to reposition every frame
    this.renderObserver = scene.onBeforeRenderObservable.add(() => {
      this.repositionAttempts++;

      // Try to reposition
      this.repositionPlanarGizmos();

      // Stop after max attempts to avoid infinite loop
      if (this.repositionAttempts >= this.maxRepositionAttempts) {
        this.stopRepositionObserver();
      }
    });
  }

  private stopRepositionObserver(): void {
    if (this.renderObserver) {
      const scene = this.gizmoManager.gizmos.positionGizmo?._rootMesh?.getScene();
      if (scene) {
        scene.onBeforeRenderObservable.remove(this.renderObserver);
      }
      this.renderObserver = null;
      this.repositionAttempts = 0;
    }
  }

  enable(): void {
    const positionGizmo = this.getPositionGizmo();
    if (!positionGizmo) return;

    this.setupDragObservables();
    configureGizmoButtons(positionGizmo, [LEFT_BUTTON]);

    // Force show planar gizmos immediately
    if (positionGizmo.xPlaneGizmo) positionGizmo.xPlaneGizmo.isEnabled = true;
    if (positionGizmo.yPlaneGizmo) positionGizmo.yPlaneGizmo.isEnabled = true;
    if (positionGizmo.zPlaneGizmo) positionGizmo.zPlaneGizmo.isEnabled = true;

    // Start the render observer to continuously try repositioning until meshes are found
    this.startRepositionObserver();
  }

  cleanup(): void {
    const positionGizmo = this.getPositionGizmo();
    if (!positionGizmo) return;

    this.gizmoManager.positionGizmoEnabled = false;
    this.cleanupDragObservables();
    this.stopRepositionObserver();
    this.resetState();
  }

  setEntities(entities: EcsEntity[]): void {
    this.currentEntities = entities;
    this.startRepositionObserver();
  }

  setUpdateCallbacks(
    updateEntityPosition: (entity: EcsEntity) => void,
    dispatchOperations: () => void,
  ): void {
    this.updateEntityPosition = updateEntityPosition;
    this.dispatchOperations = dispatchOperations;
  }

  setWorldAligned(value: boolean): void {
    this.isWorldAligned = value;
    this.updateGizmoAlignment();
  }

  setSnapDistance(distance: number): void {
    const positionGizmo = this.getPositionGizmo();
    if (!positionGizmo) return;

    positionGizmo.snapDistance = distance;

    // Also set snap distance for planar gizmos
    if (positionGizmo.xPlaneGizmo) {
      positionGizmo.xPlaneGizmo.snapDistance = distance;
    }
    if (positionGizmo.yPlaneGizmo) {
      positionGizmo.yPlaneGizmo.snapDistance = distance;
    }
    if (positionGizmo.zPlaneGizmo) {
      positionGizmo.zPlaneGizmo.snapDistance = distance;
    }
  }

  private getPositionGizmo() {
    return this.gizmoManager.gizmos.positionGizmo;
  }

  private resetState(): void {
    this.entityStates.clear();
    this.pivotPosition = null;
    this.isDragging = false;
    this.currentEntities = [];
  }

  private updateGizmoAlignment(): void {
    const positionGizmo = this.getPositionGizmo();
    if (!positionGizmo) return;

    positionGizmo.updateGizmoRotationToMatchAttachedMesh = !this.isWorldAligned;

    const gizmoNode = this.gizmoManager.attachedNode as TransformNode;
    if (!gizmoNode || this.currentEntities.length === 0) return;

    if (this.isWorldAligned) {
      this.resetGizmoRotation(gizmoNode);
    } else {
      this.syncGizmoRotationWithEntity(gizmoNode);
    }

    gizmoNode.computeWorldMatrix(true);
  }

  private resetGizmoRotation(gizmoNode: TransformNode): void {
    if (gizmoNode.rotationQuaternion) {
      gizmoNode.rotationQuaternion.set(0, 0, 0, 1); // Quaternion.Identity()
    }
  }

  private syncGizmoRotationWithEntity(gizmoNode: TransformNode): void {
    if (this.currentEntities.length !== 1) return;

    const entity = this.currentEntities[0];
    if (!entity.rotationQuaternion || !gizmoNode.rotationQuaternion) return;

    const worldRotation = this.getEntityWorldRotation(entity);
    gizmoNode.rotationQuaternion.copyFrom(worldRotation);
  }

  private getEntityWorldRotation(entity: EcsEntity): Quaternion {
    if (!entity.parent || !(entity.parent instanceof TransformNode)) {
      return entity.rotationQuaternion!;
    }

    const parent = entity.parent as TransformNode;
    const parentWorldRotation =
      parent.rotationQuaternion || Quaternion.FromRotationMatrix(parent.getWorldMatrix());

    return parentWorldRotation.multiply(entity.rotationQuaternion!);
  }

  private setupDragObservables(): void {
    const positionGizmo = this.getPositionGizmo();
    if (!positionGizmo) return;

    this.dragStartObserver = positionGizmo.onDragStartObservable.add(() => {
      const gizmoNode = this.gizmoManager.attachedNode as TransformNode;
      if (gizmoNode) {
        this.onDragStart(this.currentEntities, gizmoNode);
      }
    });

    this.dragObserver = positionGizmo.onDragObservable.add(() => {
      const gizmoNode = this.gizmoManager.attachedNode as TransformNode;
      if (gizmoNode) {
        this.update(this.currentEntities, gizmoNode);
        this.updateEntitiesInRealTime();
      }
    });

    this.dragEndObserver = positionGizmo.onDragEndObservable.add(() => {
      this.onDragEnd();
      this.dispatchOperations?.();
    });
  }

  private cleanupDragObservables(): void {
    const positionGizmo = this.getPositionGizmo();
    if (!positionGizmo) return;

    if (this.dragStartObserver) {
      positionGizmo.onDragStartObservable.remove(this.dragStartObserver);
      this.dragStartObserver = null;
    }

    if (this.dragObserver) {
      positionGizmo.onDragObservable.remove(this.dragObserver);
      this.dragObserver = null;
    }

    if (this.dragEndObserver) {
      positionGizmo.onDragEndObservable.remove(this.dragEndObserver);
      this.dragEndObserver = null;
    }
  }

  private updateEntitiesInRealTime(): void {
    if (!this.updateEntityPosition) return;

    this.currentEntities.forEach(this.updateEntityPosition);
  }

  onDragStart(entities: EcsEntity[], _gizmoNode: TransformNode): void {
    if (this.isDragging) return;

    this.isDragging = true;
    this.calculatePivotPosition(entities);
    this.storeEntityStates(entities);
  }

  private calculatePivotPosition(entities: EcsEntity[]): void {
    this.pivotPosition = new Vector3();

    for (const entity of entities) {
      const worldPosition = entity.getAbsolutePosition();
      this.pivotPosition.addInPlace(worldPosition);
    }

    this.pivotPosition.scaleInPlace(1 / entities.length);
  }

  private storeEntityStates(entities: EcsEntity[]): void {
    this.entityStates.clear();

    for (const entity of entities) {
      const worldPosition = entity.getAbsolutePosition();
      const offset = worldPosition.subtract(this.pivotPosition!);

      this.entityStates.set(entity.entityId, {
        position: entity.position.clone(),
        scale: entity.scaling.clone(),
        rotation: entity.rotationQuaternion?.clone() || Quaternion.Identity(),
        offset,
      });
    }
  }

  update(entities: EcsEntity[], gizmoNode: TransformNode): void {
    if (!this.isDragging || !this.pivotPosition) return;

    const movementDelta = gizmoNode.position.subtract(this.pivotPosition);

    for (const entity of entities) {
      this.updateEntityTransform(entity, movementDelta);
    }

    this.updateGizmoPosition(entities);
  }

  private updateEntityTransform(entity: EcsEntity, movementDelta: Vector3): void {
    const state = this.entityStates.get(entity.entityId);
    if (!state) return;

    const newWorldPosition = this.pivotPosition!.add(movementDelta).add(state.offset);
    const parent = entity.parent instanceof TransformNode ? entity.parent : null;

    if (parent) {
      this.applyLocalPosition(entity, newWorldPosition, parent, state);
    } else {
      this.applyWorldPosition(entity, newWorldPosition, state);
    }

    entity.computeWorldMatrix(true);
  }

  private applyLocalPosition(
    entity: EcsEntity,
    worldPosition: Vector3,
    parent: TransformNode,
    state: EntityState,
  ): void {
    const parentWorldMatrix = parent.getWorldMatrix();
    const parentWorldMatrixInverse = parentWorldMatrix.clone().invert();
    const localPosition = Vector3.TransformCoordinates(worldPosition, parentWorldMatrixInverse);

    this.applyTransforms(entity, localPosition, state);
  }

  private applyWorldPosition(entity: EcsEntity, worldPosition: Vector3, state: EntityState): void {
    const snappedWorldPosition = this.snapPosition(worldPosition);
    this.applyTransforms(entity, snappedWorldPosition, state);
  }

  private applyTransforms(entity: EcsEntity, position: Vector3, state: EntityState): void {
    entity.position.copyFrom(position);
    entity.scaling.copyFrom(state.scale);

    if (!entity.rotationQuaternion) {
      entity.rotationQuaternion = new Quaternion();
    }

    entity.rotationQuaternion.copyFrom(state.rotation);
    entity.rotationQuaternion.normalize();
  }

  private updateGizmoPosition(entities: EcsEntity[]): void {
    const gizmoNode = this.gizmoManager.attachedNode as TransformNode;
    if (!gizmoNode) return;

    const centroid = this.calculateCentroid(entities);
    gizmoNode.position.copyFrom(centroid);
    gizmoNode.computeWorldMatrix(true);
  }

  private calculateCentroid(entities: EcsEntity[]): Vector3 {
    const centroid = new Vector3();

    for (const entity of entities) {
      const worldPosition = entity.getAbsolutePosition();
      centroid.addInPlace(worldPosition);
    }

    centroid.scaleInPlace(1 / entities.length);
    return centroid;
  }

  onDragEnd(): void {
    this.syncGizmoWithFinalPositions();
    this.resetDragState();
  }

  private syncGizmoWithFinalPositions(): void {
    const gizmoNode = this.gizmoManager.attachedNode as TransformNode;
    if (!gizmoNode || this.currentEntities.length === 0) return;

    const centroid = this.calculateCentroid(this.currentEntities);
    gizmoNode.position.copyFrom(centroid);

    if (this.isWorldAligned) {
      this.resetGizmoRotation(gizmoNode);
    } else {
      this.syncGizmoRotationWithEntity(gizmoNode);
    }

    gizmoNode.computeWorldMatrix(true);
  }

  private resetDragState(): void {
    this.isDragging = false;
    this.pivotPosition = null;
    this.entityStates.clear();
  }
}
