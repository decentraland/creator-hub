import type { GizmoManager, Matrix, Scene, AbstractMesh } from '@babylonjs/core';
import { Vector3, TransformNode, Quaternion, Plane } from '@babylonjs/core';
import type { Entity } from '@dcl/ecs';

import type { EcsEntity } from '../EcsEntity';
import { LEFT_BUTTON } from '../mouse-utils';
import { snapVector } from '../snap-manager';
import type { IGizmoTransformer, IPlaneDragGizmoWithMesh, Vector3Axis } from './types';
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
  private isFreeDragging = false;
  private currentEntities: EcsEntity[] = [];
  private updateEntityPosition: ((entity: EcsEntity) => void) | null = null;
  private dispatchOperations: (() => void) | null = null;
  private isWorldAligned = true;
  private parentMatrixCache = new Map<TransformNode, Matrix>();
  private snapDistance = 0;
  private lastSnappedPivotPosition: Vector3 | null = null;
  private dragPlanePosition: Vector3 | null = null;

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

    positionGizmo.planarGizmoEnabled = true;
  }

  private applyPlanarGizmoOffsets(): boolean {
    const positionGizmo = this.getPositionGizmo();
    if (!positionGizmo) return false;

    const offset = 0.083;
    const tolerance = 0.01;
    let allReady = true;

    const configs: Array<{
      gizmo: IPlaneDragGizmoWithMesh;
      axes: Partial<Record<Vector3Axis, number>>;
    }> = [
      { gizmo: positionGizmo.xPlaneGizmo, axes: { y: offset, z: offset } },
      { gizmo: positionGizmo.yPlaneGizmo, axes: { x: offset, z: offset } },
      { gizmo: positionGizmo.zPlaneGizmo, axes: { x: offset, y: offset } },
    ];

    for (const { gizmo, axes } of configs) {
      const mesh = gizmo?._gizmoMesh;

      if (!mesh?.position) {
        allReady = false;
        continue;
      }

      // Apply offsets
      for (const [axis, value] of Object.entries(axes) as [Vector3Axis, number][]) {
        mesh.position[axis] = value;
      }

      // Check if they stuck
      for (const [axis, value] of Object.entries(axes) as [Vector3Axis, number][]) {
        if (Math.abs(mesh.position[axis] - value) > tolerance) {
          allReady = false;
        }
      }
    }

    return allReady;
  }

  enable(): void {
    const positionGizmo = this.getPositionGizmo();
    if (!positionGizmo) return;

    this.setupDragObservables();
    this.setupFreeDragObservables();
    this.applyPlanarGizmoOffsets();
    configureGizmoButtons(positionGizmo, [LEFT_BUTTON]);
  }

  cleanup(): void {
    const positionGizmo = this.getPositionGizmo();
    if (!positionGizmo) return;

    // Make sure gizmo is visible again if it was hidden during free drag
    if (this.isFreeDragging) {
      this.showGizmo();
    }

    this.gizmoManager.positionGizmoEnabled = false;
    this.cleanupDragObservables();
    this.cleanupFreeDragObservables();
    this.resetState();
  }

  setEntities(entities: EcsEntity[]): void {
    this.currentEntities = entities;
    this.applyPlanarGizmoOffsets();
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

    this.snapDistance = distance;
    positionGizmo.snapDistance = distance;
    positionGizmo.planarGizmoEnabled = true;

    if (positionGizmo.xPlaneGizmo) {
      positionGizmo.xPlaneGizmo.scaleRatio = 0.5;
    }
    if (positionGizmo.yPlaneGizmo) {
      positionGizmo.yPlaneGizmo.scaleRatio = 0.5;
    }
    if (positionGizmo.zPlaneGizmo) {
      positionGizmo.zPlaneGizmo.scaleRatio = 0.5;
    }
  }

  private getPositionGizmo() {
    return this.gizmoManager.gizmos.positionGizmo;
  }

  private getScene(): Scene | null {
    const positionGizmo = this.getPositionGizmo();
    if (!positionGizmo) return null;
    return positionGizmo.gizmoLayer.originalScene;
  }

  private resetState(): void {
    this.entityStates.clear();
    this.pivotPosition = null;
    this.isDragging = false;
    this.isFreeDragging = false;
    this.lastSnappedPivotPosition = null;
    this.dragPlanePosition = null;
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
      }
    });

    this.dragEndObserver = positionGizmo.onDragEndObservable.add(() => {
      this.updateEntitiesInRealTime();
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
    this.parentMatrixCache.clear();

    for (const entity of entities) {
      this.updateEntityTransform(entity, movementDelta);
    }
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
  }

  private applyLocalPosition(
    entity: EcsEntity,
    worldPosition: Vector3,
    parent: TransformNode,
    state: EntityState,
  ): void {
    // Check if we already computed the inverse matrix for this parent
    let parentWorldMatrixInverse = this.parentMatrixCache.get(parent);

    if (!parentWorldMatrixInverse) {
      // Cache miss - compute and store the inverse matrix
      const parentWorldMatrix = parent.getWorldMatrix();
      parentWorldMatrixInverse = parentWorldMatrix.clone().invert();
      this.parentMatrixCache.set(parent, parentWorldMatrixInverse);
    }

    const localPosition = Vector3.TransformCoordinates(worldPosition, parentWorldMatrixInverse);

    this.applyTransforms(entity, localPosition, state);
  }

  private applyWorldPosition(entity: EcsEntity, worldPosition: Vector3, state: EntityState): void {
    const snappedWorldPosition = this.snapPosition(worldPosition);
    this.applyTransforms(entity, snappedWorldPosition, state);
  }

  private applyTransforms(entity: EcsEntity, position: Vector3, _state: EntityState): void {
    entity.position.copyFrom(position);
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
    for (const entity of this.currentEntities) {
      entity.computeWorldMatrix(true);
    }

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
    this.isFreeDragging = false;
    this.pivotPosition = null;
    this.lastSnappedPivotPosition = null;
    this.dragPlanePosition = null;
    this.entityStates.clear();
  }

  // ========== Free Drag Methods (merged from FreeGizmo) ==========

  private setupFreeDragObservables(): void {
    const scene = this.getScene();
    if (!scene) return;

    scene.onPointerDown = event => {
      // Only start drag on left mouse button
      if (event.button !== LEFT_BUTTON || this.currentEntities.length === 0) return;

      const clickedEntity = this.findClickedEntityFromSelected();
      if (!clickedEntity) return;

      // Check if we clicked on the gizmo itself - if so, don't start free drag
      const positionGizmo = this.getPositionGizmo();
      if (positionGizmo && this.isGizmoMesh(event)) {
        return; // Let the gizmo handle it
      }

      this.startFreeDrag();
    };

    scene.onPointerMove = () => {
      if (!this.isFreeDragging) return;

      const delta = this.calculateFreeDragDelta();
      if (!delta) return;

      this.handleFreeDrag(delta);
    };

    scene.onPointerUp = () => {
      if (this.isFreeDragging) {
        this.handleFreeDragEnd();
      }
    };
  }

  private cleanupFreeDragObservables(): void {
    const scene = this.getScene();
    if (!scene) return;

    scene.onPointerDown = undefined;
    scene.onPointerMove = undefined;
    scene.onPointerUp = undefined;
  }

  private isGizmoMesh(_event: any): boolean {
    const scene = this.getScene();
    const positionGizmo = this.getPositionGizmo();
    if (!positionGizmo || !scene) return false;

    const pickResult = scene.pick(scene.pointerX, scene.pointerY);
    if (!pickResult?.hit || !pickResult.pickedMesh) return false;

    const mesh = pickResult.pickedMesh;

    // Check if the mesh is part of any gizmo
    const gizmos = [
      positionGizmo.xGizmo,
      positionGizmo.yGizmo,
      positionGizmo.zGizmo,
      positionGizmo.xPlaneGizmo,
      positionGizmo.yPlaneGizmo,
      positionGizmo.zPlaneGizmo,
    ];

    for (const gizmo of gizmos) {
      if (gizmo?._rootMesh && (mesh === gizmo._rootMesh || mesh.isDescendantOf(gizmo._rootMesh))) {
        return true;
      }
    }

    return false;
  }

  private findClickedEntityFromSelected(): { entity: EcsEntity; mesh: AbstractMesh } | null {
    const scene = this.getScene();
    if (!scene) return null;

    const pickResult = scene.pick(scene.pointerX, scene.pointerY, mesh => {
      for (const entity of this.currentEntities) {
        if (
          mesh.isDescendantOf(entity) ||
          mesh === entity.meshRenderer ||
          mesh === entity.gltfContainer
        ) {
          return true;
        }
      }
      return false;
    });

    if (!pickResult?.hit || !pickResult.pickedMesh) return null;

    for (const entity of this.currentEntities) {
      if (
        pickResult.pickedMesh.isDescendantOf(entity) ||
        pickResult.pickedMesh === entity.meshRenderer ||
        pickResult.pickedMesh === entity.gltfContainer
      ) {
        return { entity, mesh: pickResult.pickedMesh };
      }
    }

    return null;
  }

  private startFreeDrag(): void {
    this.isFreeDragging = true;
    this.hideGizmo();
    this.initializeFreeDragPivot();
    this.initializeFreeDragOffsets();

    if (this.pivotPosition) {
      this.dragPlanePosition = this.pivotPosition.clone();
    }
  }

  private initializeFreeDragPivot(): void {
    const scene = this.getScene();
    if (!scene) return;

    const pickInfo = scene.pick(scene.pointerX, scene.pointerY);
    this.pivotPosition = pickInfo?.pickedPoint
      ? pickInfo.pickedPoint.clone()
      : this.calculateCentroid(this.currentEntities);
    this.lastSnappedPivotPosition = this.pivotPosition.clone();
  }

  private initializeFreeDragOffsets(): void {
    this.entityStates.clear();
    for (const entity of this.currentEntities) {
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

  private calculateFreeDragDelta(): Vector3 | null {
    const scene = this.getScene();
    if (!scene || !this.pivotPosition || !this.dragPlanePosition) return null;

    const camera = scene.activeCamera;
    if (!camera) return null;

    const ray = scene.createPickingRay(scene.pointerX, scene.pointerY, null, camera);

    const dragPlane = Plane.FromPositionAndNormal(
      new Vector3(0, this.dragPlanePosition.y, 0),
      Vector3.Up(),
    );

    const distance = ray.intersectsPlane(dragPlane);
    if (distance === null) return null;

    const newPosition = ray.origin.add(ray.direction.scale(distance));
    const delta = newPosition.subtract(this.pivotPosition);

    return delta;
  }

  private handleFreeDrag(delta: Vector3): void {
    if (!this.isFreeDragging || !this.pivotPosition || !this.lastSnappedPivotPosition) return;

    const worldDelta = delta.clone();
    worldDelta.y = 0; // keep Y position unchanged for free drag
    this.pivotPosition.addInPlace(worldDelta);

    if (this.shouldMoveEntitiesForFreeDrag()) {
      this.moveEntitiesToFreeDragPivot();
    }
  }

  private shouldMoveEntitiesForFreeDrag(): boolean {
    if (this.snapDistance <= 0) return true;

    const distanceFromLastSnapped = Vector3.Distance(
      this.pivotPosition!,
      this.lastSnappedPivotPosition!,
    );
    return distanceFromLastSnapped >= this.snapDistance;
  }

  private moveEntitiesToFreeDragPivot(): void {
    const finalPivotPosition = this.getFreeDragSnappedPivotPosition();

    for (const entity of this.currentEntities) {
      const state = this.entityStates.get(entity.entityId);
      if (!state) continue;

      const newWorldPosition = finalPivotPosition.add(state.offset);
      this.applyWorldPositionToEntity(entity, newWorldPosition);
    }

    if (this.updateEntityPosition) {
      this.currentEntities.forEach(this.updateEntityPosition);
    }
  }

  private getFreeDragSnappedPivotPosition(): Vector3 {
    if (this.snapDistance <= 0) return this.pivotPosition!;

    const snappedPivotPosition = snapVector(this.pivotPosition!, this.snapDistance);
    snappedPivotPosition.y = this.pivotPosition!.y;
    this.lastSnappedPivotPosition = snappedPivotPosition.clone();

    return snappedPivotPosition;
  }

  private applyWorldPositionToEntity(entity: EcsEntity, worldPosition: Vector3): void {
    const parent = entity.parent instanceof TransformNode ? entity.parent : null;

    if (parent) {
      const parentWorldMatrix = parent.getWorldMatrix();
      const parentWorldMatrixInverse = parentWorldMatrix.invert();
      const localPosition = Vector3.TransformCoordinates(worldPosition, parentWorldMatrixInverse);
      entity.position.copyFrom(localPosition);
    } else {
      entity.position.copyFrom(worldPosition);
    }

    this.updateEntityTransformImmediate(entity);
  }

  private updateEntityTransformImmediate(entity: EcsEntity): void {
    entity.computeWorldMatrix(true);

    if (typeof (entity as any).refreshBoundingInfo === 'function') {
      (entity as any).refreshBoundingInfo();
    }

    if (typeof entity.getChildMeshes === 'function') {
      entity.getChildMeshes().forEach(mesh => {
        if (typeof mesh.refreshBoundingInfo === 'function') {
          mesh.refreshBoundingInfo({});
        }
        if (typeof mesh.computeWorldMatrix === 'function') {
          mesh.computeWorldMatrix(true);
        }
      });
    }
  }

  private handleFreeDragEnd(): void {
    this.isFreeDragging = false;
    this.pivotPosition = null;
    this.dragPlanePosition = null;
    this.lastSnappedPivotPosition = null;

    // Sync the gizmo position after free drag
    const gizmoNode = this.gizmoManager.attachedNode as TransformNode;
    if (gizmoNode && this.currentEntities.length > 0) {
      const centroid = this.calculateCentroid(this.currentEntities);
      gizmoNode.position.copyFrom(centroid);
      gizmoNode.computeWorldMatrix(true);
    }

    // Show the gizmo again at the new position
    this.showGizmo();

    this.dispatchOperations?.();
  }

  private hideGizmo(): void {
    const positionGizmo = this.getPositionGizmo();
    if (!positionGizmo) return;

    const gizmos = [
      positionGizmo.xGizmo,
      positionGizmo.yGizmo,
      positionGizmo.zGizmo,
      positionGizmo.xPlaneGizmo,
      positionGizmo.yPlaneGizmo,
      positionGizmo.zPlaneGizmo,
    ];

    for (const gizmo of gizmos) {
      if (gizmo?._rootMesh) {
        gizmo._rootMesh.setEnabled(false);
      }
    }
  }

  private showGizmo(): void {
    const positionGizmo = this.getPositionGizmo();
    if (!positionGizmo) return;

    const gizmos = [
      positionGizmo.xGizmo,
      positionGizmo.yGizmo,
      positionGizmo.zGizmo,
      positionGizmo.xPlaneGizmo,
      positionGizmo.yPlaneGizmo,
      positionGizmo.zPlaneGizmo,
    ];

    for (const gizmo of gizmos) {
      if (gizmo?._rootMesh) {
        gizmo._rootMesh.setEnabled(true);
      }
    }
  }
}
