import type { Scene, AbstractMesh, Nullable, Observer, PickingInfo } from '@babylonjs/core';
import {
  Vector3,
  TransformNode,
  UtilityLayerRenderer,
  PointerDragBehavior,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Mesh,
  Plane,
} from '@babylonjs/core';
import type { Entity } from '@dcl/ecs';
import type { EcsEntity } from '../EcsEntity';
import { LEFT_BUTTON } from '../mouse-utils';
import { snapVector } from '../snap-manager';
import type { IGizmoTransformer } from './types';
import { GizmoType } from './types';

interface GizmoManagerInterface {
  calculateCentroid: () => Vector3;
}

export class FreeGizmo implements IGizmoTransformer {
  type = GizmoType.FREE;
  private selectedEntities: EcsEntity[] = [];
  private isDragging = false;
  private snapDistance = 0;
  private isWorldAligned = true;

  private dragBehavior: PointerDragBehavior;
  private dragStartObserver: Nullable<Observer<any>> = null;
  private dragObserver: Nullable<Observer<any>> = null;
  private dragEndObserver: Nullable<Observer<any>> = null;

  private pivotPosition: Vector3 | null = null;
  private lastSnappedPivotPosition: Vector3 | null = null;
  private entityOffsets = new Map<Entity, Vector3>();
  private dragPlanePosition: Vector3 | null = null; // Cache initial ground plane position

  private gizmoIndicator: AbstractMesh | null = null;

  private onDragEndCallback: (() => void) | null = null;
  private updateEntityPosition: ((entity: EcsEntity) => void) | null = null;
  private dispatchOperations: (() => void) | null = null;

  private gizmoManager: GizmoManagerInterface | null = null;

  constructor(
    private scene: Scene,
    private utilityLayer: UtilityLayerRenderer = new UtilityLayerRenderer(scene),
  ) {
    this.dragBehavior = this.createDragBehavior();
  }

  setup(): void {
    this.cleanup();
    this.setupSceneObservers();
    this.createGizmoIndicator();
  }

  enable(): void {
    this.setupDragObservers();
  }

  cleanup(): void {
    this.removeSceneObservers();
    this.cleanupDragObservers();
    this.detachDragBehavior();
    this.removeGizmoIndicator();
    this.resetState();
  }

  setEntities(entities: EcsEntity[]): void {
    this.selectedEntities = entities;
    this.updateGizmoIndicator();
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
  }

  setSnapDistance(distance: number): void {
    this.snapDistance = distance;
  }

  setOnDragEndCallback(callback: () => void): void {
    this.onDragEndCallback = callback;
  }

  setGizmoManager(gizmoManager: GizmoManagerInterface): void {
    this.gizmoManager = gizmoManager;
  }

  onDragStart(entities: EcsEntity[], _gizmoNode: TransformNode): void {
    this.selectedEntities = entities;
    this.resetDragState();
  }

  update(entities: EcsEntity[], _gizmoNode: TransformNode): void {
    if (entities !== this.selectedEntities) {
      this.selectedEntities = entities;
      this.resetDragState();
    }
  }

  onDragEnd(): void {
    this.cleanup();
  }

  dispose(): void {
    this.cleanup();
    this.utilityLayer.dispose();
  }

  private createDragBehavior(): PointerDragBehavior {
    const behavior = new PointerDragBehavior({ dragPlaneNormal: new Vector3(0, 1, 0) });
    behavior.useObjectOrientationForDragging = false;
    behavior.dragButtons = [LEFT_BUTTON];
    behavior.moveAttached = false;
    return behavior;
  }

  private resetState(): void {
    this.selectedEntities = [];
    this.pivotPosition = null;
    this.lastSnappedPivotPosition = null;
    this.entityOffsets.clear();
    this.isDragging = false;
    this.onDragEndCallback = null;
    this.updateEntityPosition = null;
    this.dispatchOperations = null;
  }

  private resetDragState(): void {
    this.pivotPosition = null;
    this.entityOffsets.clear();
    this.detachDragBehavior();
  }

  private setupSceneObservers(): void {
    this.scene.onPointerDown = (event, pickResult) => {
      // Only start drag on left mouse button to avoid interfering with camera controls
      if (event.button !== LEFT_BUTTON || !this.canStartDrag(pickResult)) return;

      const clickedEntity = this.findClickedEntityFromSelected();
      if (!clickedEntity) return; // Entity pointed is not selected

      this.startDrag(clickedEntity.entity, clickedEntity.mesh);
    };

    this.scene.onPointerMove = () => {
      if (!this.isDragging) return;

      const delta = this.calculateDragDelta();
      if (!delta) return;

      this.handleDrag({ delta });
    };

    this.scene.onPointerUp = () => {
      if (this.isDragging) {
        this.handleDragEnd();
      }
    };
  }

  private removeSceneObservers(): void {
    this.scene.onPointerDown = () => {};
    this.scene.onPointerMove = () => {};
    this.scene.onPointerUp = () => {};
  }

  private canStartDrag(_pickResult: PickingInfo | null): boolean {
    return this.selectedEntities.length > 0;
  }

  private setupDragObservers(): void {
    this.dragStartObserver = this.dragBehavior.onDragStartObservable.add(() => {
      this.isDragging = true;
    });

    this.dragObserver = this.dragBehavior.onDragObservable.add(eventData => {
      this.handleDrag(eventData);
    });

    this.dragEndObserver = this.dragBehavior.onDragEndObservable.add(() => {
      this.handleDragEnd();
    });
  }

  private cleanupDragObservers(): void {
    if (this.dragStartObserver) {
      this.dragBehavior.onDragStartObservable.remove(this.dragStartObserver);
      this.dragStartObserver = null;
    }

    if (this.dragObserver) {
      this.dragBehavior.onDragObservable.remove(this.dragObserver);
      this.dragObserver = null;
    }

    if (this.dragEndObserver) {
      this.dragBehavior.onDragEndObservable.remove(this.dragEndObserver);
      this.dragEndObserver = null;
    }
  }

  private detachDragBehavior(): void {
    this.dragBehavior.detach();
  }

  private handleDrag(eventData: { delta: Vector3 }): void {
    if (
      !this.isDragging ||
      !eventData.delta ||
      !this.pivotPosition ||
      !this.lastSnappedPivotPosition
    )
      return;

    this.updatePivotPosition(eventData.delta);

    if (this.shouldMoveEntities()) {
      this.moveEntitiesToPivot();
    }
  }

  private handleDragEnd(): void {
    this.isDragging = false;
    this.detachDragBehavior();
    this.pivotPosition = null;
    this.dragPlanePosition = null;
    this.entityOffsets.clear();
    this.updateGizmoIndicator();
    this.dispatchOperations?.();
    this.onDragEndCallback?.();
  }

  private updatePivotPosition(delta: Vector3): void {
    const worldDelta = delta.clone();
    worldDelta.y = 0; // keep Y position unchanged for free gizmo
    this.pivotPosition!.addInPlace(worldDelta);
  }

  private shouldMoveEntities(): boolean {
    if (this.snapDistance <= 0) return true;

    const distanceFromLastSnapped = Vector3.Distance(
      this.pivotPosition!,
      this.lastSnappedPivotPosition!,
    );
    return distanceFromLastSnapped >= this.snapDistance;
  }

  private moveEntitiesToPivot(): void {
    const finalPivotPosition = this.getSnappedPivotPosition();

    for (const entity of this.selectedEntities) {
      const offset = this.entityOffsets.get(entity.entityId);
      if (!offset) continue;

      const newWorldPosition = finalPivotPosition.add(offset);
      this.applyWorldPositionToEntity(entity, newWorldPosition);
    }

    this.updateEntityPosition && this.selectedEntities.forEach(this.updateEntityPosition);
    this.updateGizmoIndicator();
  }

  private getSnappedPivotPosition(): Vector3 {
    if (this.snapDistance <= 0) return this.pivotPosition!;

    const snappedPivotPosition = snapVector(this.pivotPosition!, this.snapDistance);
    snappedPivotPosition.y = this.pivotPosition!.y; // Preserve Y position
    this.lastSnappedPivotPosition = snappedPivotPosition.clone();

    return snappedPivotPosition;
  }

  private initializePivotPosition(): void {
    // Use cursor position at drag start as pivot to avoid entities jumping to center
    const pickInfo = this.scene.pick(this.scene.pointerX, this.scene.pointerY);
    this.pivotPosition = pickInfo?.pickedPoint ? pickInfo.pickedPoint.clone() : this.getCentroid();
    this.lastSnappedPivotPosition = this.pivotPosition.clone();
  }

  private initializeEntityOffsets(): void {
    this.entityOffsets.clear();
    for (const entity of this.selectedEntities) {
      const offset = entity.getAbsolutePosition().subtract(this.pivotPosition!);
      this.entityOffsets.set(entity.entityId, offset);
    }
  }

  /** Manual drag implementation: raycast against a horizontal plane at the drag start Y position.
   * This approach is necessary because PointerDragBehavior cannot be attached after pointer down.
   * Raycasting against a plane (instead of full scene picking) maintains performance while
   * providing accurate cursor-to-world position mapping regardless of camera angle.
   */
  private calculateDragDelta(): Vector3 | null {
    if (!this.pivotPosition || !this.dragPlanePosition) return null;

    const camera = this.scene.activeCamera;
    if (!camera) return null;

    const ray = this.scene.createPickingRay(this.scene.pointerX, this.scene.pointerY, null, camera);

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

  /** Custom picking with predicate to only consider selected entities' meshes.
   * By filtering to only selected entities,
   * we ensure the user can interact with the currently selected entity even if others overlap.
   */
  private findClickedEntityFromSelected(): { entity: EcsEntity; mesh: AbstractMesh } | null {
    const pickResult = this.scene.pick(this.scene.pointerX, this.scene.pointerY, mesh => {
      for (const entity of this.selectedEntities) {
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

    // Find which entity the picked mesh belongs to
    for (const entity of this.selectedEntities) {
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

  private startDrag(clickedEntity: EcsEntity, pickedMesh: AbstractMesh): void {
    this.isDragging = true;
    this.initializePivotPosition();
    this.initializeEntityOffsets();
    this.attachDragBehavior(clickedEntity, pickedMesh);

    // Cache the pivot position for raycasting plane intersection during drag.
    if (this.pivotPosition) {
      this.dragPlanePosition = this.pivotPosition.clone();
    }
  }

  private attachDragBehavior(clickedEntity: EcsEntity, pickedMesh: AbstractMesh): void {
    const dragMesh = this.getDragMesh(clickedEntity, pickedMesh);
    this.dragBehavior.attach(dragMesh);
  }

  private getDragMesh(clickedEntity: EcsEntity, pickedMesh: AbstractMesh): AbstractMesh {
    if (clickedEntity.meshRenderer) {
      return clickedEntity.meshRenderer;
    } else if (clickedEntity.gltfContainer) {
      return clickedEntity.gltfContainer;
    } else {
      const childMeshes = clickedEntity.getChildMeshes();
      return childMeshes.length > 0 ? childMeshes[0] : pickedMesh;
    }
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

    this.updateEntityTransform(entity);
  }

  private updateEntityTransform(entity: EcsEntity): void {
    // Force immediate world matrix update
    entity.computeWorldMatrix(true);

    // Update bounding info for the entity
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

    // Update bounding info mesh if it exists
    if ((entity as any).boundingInfoMesh) {
      const boundingInfoMesh = (entity as any).boundingInfoMesh;
      if (typeof boundingInfoMesh.refreshBoundingInfo === 'function') {
        boundingInfoMesh.refreshBoundingInfo();
      }
      if (typeof boundingInfoMesh.computeWorldMatrix === 'function') {
        boundingInfoMesh.computeWorldMatrix(true);
      }
    }
  }

  private getCentroid(): Vector3 {
    if (this.gizmoManager?.calculateCentroid) {
      return this.gizmoManager.calculateCentroid();
    }

    if (this.selectedEntities.length === 0) return Vector3.Zero();

    const centroid = new Vector3();
    for (const entity of this.selectedEntities) {
      centroid.addInPlace(entity.getAbsolutePosition());
    }
    return centroid.scale(1 / this.selectedEntities.length);
  }

  private createGizmoIndicator(): void {
    if (this.gizmoIndicator) return;

    this.gizmoIndicator = this.createCrossMesh();
    this.gizmoIndicator.renderingGroupId = 1;
    this.gizmoIndicator.alwaysSelectAsActiveMesh = true;
    this.gizmoIndicator.doNotSyncBoundingInfo = true;
    this.gizmoIndicator.ignoreNonUniformScaling = true;
  }

  private createCrossMesh(): Mesh {
    const crossMesh = new Mesh('freeGizmoCross', this.utilityLayer.utilityLayerScene);

    const leftStick = MeshBuilder.CreateBox(
      'leftStick',
      {
        width: 0.25,
        height: 0.012,
        depth: 0.012,
      },
      this.utilityLayer.utilityLayerScene,
    );
    leftStick.position.x = -0.15;
    leftStick.material = this.createRedMaterial();
    leftStick.parent = crossMesh;

    const rightStick = MeshBuilder.CreateBox(
      'rightStick',
      {
        width: 0.25,
        height: 0.012,
        depth: 0.012,
      },
      this.utilityLayer.utilityLayerScene,
    );
    rightStick.position.x = 0.15;
    rightStick.material = this.createRedMaterial();
    rightStick.parent = crossMesh;

    const topStick = MeshBuilder.CreateBox(
      'topStick',
      {
        width: 0.012,
        height: 0.012,
        depth: 0.25,
      },
      this.utilityLayer.utilityLayerScene,
    );
    topStick.position.z = -0.15;
    topStick.material = this.createBlueMaterial();
    topStick.parent = crossMesh;

    const bottomStick = MeshBuilder.CreateBox(
      'bottomStick',
      {
        width: 0.012,
        height: 0.012,
        depth: 0.25,
      },
      this.utilityLayer.utilityLayerScene,
    );
    bottomStick.position.z = 0.15;
    bottomStick.material = this.createBlueMaterial();
    bottomStick.parent = crossMesh;

    return crossMesh;
  }

  private createRedMaterial(): StandardMaterial {
    const material = new StandardMaterial('redStickMaterial', this.utilityLayer.utilityLayerScene);
    material.diffuseColor = new Color3(1, 0, 0);
    material.emissiveColor = new Color3(0.8, 0, 0);
    material.alpha = 1.0;
    material.zOffset = 2;
    material.forceDepthWrite = true;
    material.disableDepthWrite = false;
    material.backFaceCulling = false;
    return material;
  }

  private createBlueMaterial(): StandardMaterial {
    const material = new StandardMaterial('blueStickMaterial', this.utilityLayer.utilityLayerScene);
    material.diffuseColor = new Color3(0, 0, 1);
    material.emissiveColor = new Color3(0, 0, 0.8);
    material.alpha = 1.0;
    material.zOffset = 2;
    material.forceDepthWrite = true;
    material.disableDepthWrite = false;
    material.backFaceCulling = false;
    return material;
  }

  updateGizmoIndicator(): void {
    if (!this.gizmoIndicator || this.selectedEntities.length === 0) return;
    const center = this.getCentroid();
    this.gizmoIndicator.position = center;
  }

  private removeGizmoIndicator(): void {
    if (this.gizmoIndicator) {
      const childMeshes = this.gizmoIndicator.getChildMeshes();
      childMeshes.forEach(child => {
        if (child.material) {
          child.material.dispose();
        }
        child.dispose();
      });

      this.gizmoIndicator.dispose();
      this.gizmoIndicator = null;
    }
  }
}
