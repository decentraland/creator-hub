import type { Scene, AbstractMesh, Matrix } from '@babylonjs/core';
import {
  Vector3,
  TransformNode,
  UtilityLayerRenderer,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Mesh,
  Plane,
} from '@babylonjs/core';
import type { Entity } from '@dcl/ecs';
import type { EcsEntity } from '../EcsEntity';
import { LEFT_BUTTON } from '../mouse-utils';
import { snapPosition, snapVector } from '../snap-manager';
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

  private pivotPosition: Vector3 | null = null;
  private lastSnappedPivotPosition: Vector3 | null = null;
  private entityOffsets = new Map<Entity, Vector3>();
  private dragPlanePosition: Vector3 | null = null; // Cache initial ground plane position
  private cachedDragPlane: Plane | null = null; // Reused each frame — plane is fixed during drag
  private parentMatrixCache = new Map<TransformNode, Matrix>(); // Avoids per-entity matrix inversion
  // Scratch vectors — reused every frame to avoid GC pressure
  private _scratchHitPoint = new Vector3();
  private _scratchDelta = new Vector3();

  private gizmoIndicator: AbstractMesh | null = null;

  private onDragEndCallback: (() => void) | null = null;
  private updateEntityPosition: ((entity: EcsEntity) => void) | null = null;
  private dispatchOperations: (() => void) | null = null;
  private dispatchDuringDrag: (() => void) | null = null;

  private gizmoManager: GizmoManagerInterface | null = null;
  private objectSnapFn:
    | ((entity: EcsEntity, position: Vector3, currentEntities: EcsEntity[]) => Vector3 | null)
    | null = null;

  constructor(
    private scene: Scene,
    private utilityLayer: UtilityLayerRenderer = new UtilityLayerRenderer(scene),
  ) {}

  setup(): void {
    this.cleanup();
    this.setupSceneObservers();
    this.createGizmoIndicator();
  }

  enable(): void {
    // No-op: drag is handled entirely by setupSceneObservers
  }

  cleanup(): void {
    this.removeSceneObservers();
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

  setObjectSnapFn(
    fn: (entity: EcsEntity, position: Vector3, currentEntities: EcsEntity[]) => Vector3 | null,
  ): void {
    this.objectSnapFn = fn;
  }

  setDispatchDuringDragCallback(fn: () => void): void {
    this.dispatchDuringDrag = fn;
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
  }

  private setupSceneObservers(): void {
    this.scene.onPointerDown = event => {
      // Only start drag on left mouse button to avoid interfering with camera controls
      if (event.button !== LEFT_BUTTON || this.selectedEntities.length === 0) return;

      const clickedEntity = this.findClickedEntityFromSelected();
      if (!clickedEntity) return; // Entity pointed is not selected

      this.startDrag();
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
    this.pivotPosition = null;
    this.dragPlanePosition = null;
    this.cachedDragPlane = null;
    this.parentMatrixCache.clear();
    this.entityOffsets.clear();
    this.updateGizmoIndicator();
    this.dispatchOperations?.();
    this.onDragEndCallback?.();
  }

  private updatePivotPosition(delta: Vector3): void {
    // Y is intentionally excluded — FreeGizmo moves on the XZ plane only
    this.pivotPosition!.x += delta.x;
    this.pivotPosition!.z += delta.z;
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
    this.parentMatrixCache.clear();

    for (const entity of this.selectedEntities) {
      const offset = this.entityOffsets.get(entity.entityId);
      if (!offset) continue;

      const newWorldPosition = finalPivotPosition.add(offset);
      this.applyWorldPositionToEntity(entity, newWorldPosition);
    }

    this.updateEntityPosition && this.selectedEntities.forEach(this.updateEntityPosition);
    this.dispatchDuringDrag?.();
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
    if (!this.pivotPosition || !this.cachedDragPlane) return null;

    const camera = this.scene.activeCamera;
    if (!camera) return null;

    const ray = this.scene.createPickingRay(this.scene.pointerX, this.scene.pointerY, null, camera);

    const distance = ray.intersectsPlane(this.cachedDragPlane);
    // null  → ray parallel to plane (camera looking sideways)
    // <= 0  → intersection is behind the camera
    if (distance === null || distance <= 0) return null;

    // Reuse scratch vectors: hitPoint = ray.origin + ray.direction * distance
    ray.direction.scaleToRef(distance, this._scratchHitPoint);
    this._scratchHitPoint.addInPlace(ray.origin);
    this._scratchHitPoint.subtractToRef(this.pivotPosition, this._scratchDelta);

    return this._scratchDelta;
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

  private startDrag(): void {
    this.isDragging = true;
    this.initializePivotPosition();
    this.initializeEntityOffsets();

    // Cache the pivot position and drag plane for raycasting during drag.
    // The plane is fixed for the entire drag, so we build it once here.
    if (this.pivotPosition) {
      this.dragPlanePosition = this.pivotPosition.clone();
      this.cachedDragPlane = Plane.FromPositionAndNormal(
        new Vector3(0, this.dragPlanePosition.y, 0),
        Vector3.Up(),
      );
    }
  }

  private applyWorldPositionToEntity(entity: EcsEntity, worldPosition: Vector3): void {
    const gridSnapped = snapPosition(worldPosition);
    gridSnapped.y = worldPosition.y; // FreeGizmo moves on XZ plane only — preserve Y
    const objectSnapped = this.objectSnapFn?.(entity, gridSnapped, this.selectedEntities);
    const finalWorldPosition = objectSnapped ?? gridSnapped;

    const parent = entity.parent instanceof TransformNode ? entity.parent : null;

    if (parent) {
      let parentInverse = this.parentMatrixCache.get(parent);
      if (!parentInverse) {
        parentInverse = parent.getWorldMatrix().clone().invert();
        this.parentMatrixCache.set(parent, parentInverse);
      }
      entity.position.copyFrom(Vector3.TransformCoordinates(finalWorldPosition, parentInverse));
    } else {
      entity.position.copyFrom(finalWorldPosition);
    }

    // Update the entity's world matrix immediately so getAbsolutePosition() and object
    // snap are correct within the same frame. Child world matrices are lazy in Babylon —
    // they update on demand before render or when explicitly accessed, so we don't need
    // to force them here.
    entity.computeWorldMatrix(true);
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
