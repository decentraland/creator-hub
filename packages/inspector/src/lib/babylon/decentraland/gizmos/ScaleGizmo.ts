import type {
  GizmoManager,
  IScaleGizmo,
  Mesh,
  Observer,
  PointerInfo,
  StandardMaterial,
} from '@babylonjs/core';
import { Vector3, TransformNode, Quaternion, Color3, PointerEventTypes } from '@babylonjs/core';
import type { Entity } from '@dcl/ecs';
import type { EcsEntity } from '../EcsEntity';
import { LEFT_BUTTON } from '../mouse-utils';
import type { IGizmoTransformer, PlaneType } from './types';
import { GizmoType } from './types';
import { configureGizmoButtons, createPlane, TransformUtils } from './utils';
import {
  AXIS_BLUE,
  AXIS_GREEN,
  AXIS_RED,
  FADE_ALPHA,
  FULL_ALPHA,
  GREY_INACTIVE_COLOR,
  PLANE_CONFIGS,
  YELLOW_HOVER_COLOR,
  YELLOW_HOVER_EMISSIVE,
} from './constants';

export class ScaleGizmo implements IGizmoTransformer {
  type = GizmoType.SCALE;
  private initialOffsets = new Map<Entity, Vector3>();
  private initialScales = new Map<Entity, Vector3>();
  private initialRotations = new Map<Entity, Quaternion>();
  private initialPositions = new Map<Entity, Vector3>();
  private pivotPosition: Vector3 | null = null;
  private initialGizmoScale: Vector3 | null = null;
  private isDragging = false;
  private dragStartObserver: any = null;
  private dragObserver: any = null;
  private dragEndObserver: any = null;
  private currentEntities: EcsEntity[] = [];
  private updateEntityScale: ((entity: EcsEntity) => void) | null = null;
  private dispatchOperations: (() => void) | null = null;
  private isWorldAligned = true;

  // Sensitivity multiplier: higher = model scales more relative to gizmo visual movement
  private readonly scaleSensitivity = 2.0;
  private planeCubesCreated = false;
  private planeCubeMeshes: Mesh[] = []; // Store references to dispose them
  private planeMaterials: Map<
    Mesh,
    { material: StandardMaterial; originalDiffuse: Color3; originalEmissive: Color3 }
  > = new Map(); // Store material refs
  private activelyDraggingPlane: Mesh | null = null;
  private planePointerObservers: Observer<PointerInfo>[] = [];

  constructor(
    private gizmoManager: GizmoManager,
    private snapScale: (scale: Vector3) => Vector3,
  ) {}

  setup(): void {
    if (!this.gizmoManager.gizmos.scaleGizmo) return;
    const scaleGizmo = this.gizmoManager.gizmos.scaleGizmo;
    // Scale gizmo should always be locally aligned to the entity
    scaleGizmo.updateGizmoRotationToMatchAttachedMesh = true;

    // Note: ScaleGizmo doesn't support planar gizmos (those colored panels)
    // So we'll create custom thin cubes that look like planes!
    this.configureUniformScaleGizmo();
  }

  private createPlaneCubes(): void {
    if (!this.gizmoManager.gizmos.scaleGizmo || this.planeCubesCreated) return;

    const scene = this.gizmoManager.gizmos.scaleGizmo?._rootMesh?.getScene();
    if (!scene) return;

    const rootMesh = this.gizmoManager.gizmos.scaleGizmo._rootMesh;
    if (!rootMesh) return;

    for (const config of PLANE_CONFIGS) {
      const [plane, material] = createPlane(
        scene,
        rootMesh,
        `scalePlane${config.type}`,
        config.dimensions[0],
        config.dimensions[1],
        config.dimensions[2],
        config.position,
        config.diffuse,
        config.emissive,
      );

      this.planeCubeMeshes.push(plane);
      this.planeMaterials.set(plane, {
        material,
        originalDiffuse: config.diffuse,
        originalEmissive: config.emissive,
      });

      this.addPlaneHoverBehavior(plane);
      this.addPlaneDragBehavior(plane, config.type);
    }

    this.planeCubesCreated = true;
  }

  private addPlaneHoverBehavior(planeMesh: Mesh): void {
    const scene = planeMesh.getScene();
    const matInfo = this.planeMaterials.get(planeMesh);
    if (!matInfo) return;

    const onPointerMove = (pointerInfo: PointerInfo) => {
      if (pointerInfo.type !== PointerEventTypes.POINTERMOVE) return;
      const pickInfo = pointerInfo.pickInfo;
      const isHovering = pickInfo?.hit && pickInfo.pickedMesh === planeMesh;

      // Skip if dragging a different plane
      if (this.activelyDraggingPlane && this.activelyDraggingPlane !== planeMesh) return;

      if (isHovering && !this.activelyDraggingPlane) {
        matInfo.material.diffuseColor = YELLOW_HOVER_COLOR;
        matInfo.material.emissiveColor = YELLOW_HOVER_EMISSIVE;
      } else if (!isHovering && this.activelyDraggingPlane !== planeMesh && !this.isDragging) {
        matInfo.material.diffuseColor = matInfo.originalDiffuse;
        matInfo.material.emissiveColor = matInfo.originalEmissive;
      }
    };

    const hoverObserver = scene.onPointerObservable.add(onPointerMove);
    this.planePointerObservers.push(hoverObserver);
  }

  private addPlaneDragBehavior(planeMesh: Mesh, planeType: PlaneType): void {
    const scene = planeMesh.getScene();
    let isDragging = false;
    let initialMousePos: { x: number; y: number } | null = null;
    const initialEntityScales = new Map<Entity, Vector3>();

    const onPointerDown = (pointerInfo: PointerInfo) => {
      if (pointerInfo.type !== PointerEventTypes.POINTERDOWN) return;

      const pickInfo = pointerInfo.pickInfo;
      if (!pickInfo || !pickInfo.hit || pickInfo.pickedMesh !== planeMesh) return;

      if (pointerInfo.event.button !== LEFT_BUTTON) return;

      isDragging = true;
      initialMousePos = { x: pointerInfo.event.clientX, y: pointerInfo.event.clientY };

      this.activelyDraggingPlane = planeMesh;

      // Keep this plane yellow during drag
      const matInfo = this.planeMaterials.get(planeMesh);
      if (matInfo) {
        matInfo.material.diffuseColor = YELLOW_HOVER_COLOR;
        matInfo.material.emissiveColor = YELLOW_HOVER_EMISSIVE;
      }

      this.setPlaneMaterialsAppearance('inactive', planeMesh);
      this.setBuiltInGizmoAppearance('inactive');

      // Store initial scales for all entities
      initialEntityScales.clear();
      for (const entity of this.currentEntities) {
        initialEntityScales.set(entity.entityId, entity.scaling.clone());
      }

      this.onDragStart(this.currentEntities, this.gizmoManager.attachedNode as TransformNode);
    };

    const onPointerMove = (pointerInfo: PointerInfo) => {
      if (
        !isDragging ||
        !initialMousePos ||
        pointerInfo.type !== PointerEventTypes.POINTERMOVE ||
        !this.pivotPosition
      )
        return;

      const currentMousePos = { x: pointerInfo.event.clientX, y: pointerInfo.event.clientY };
      const deltaX = currentMousePos.x - initialMousePos.x;
      const deltaY = currentMousePos.y - initialMousePos.y;

      // Use the drag direction for scaling
      const dragDirection = deltaX + deltaY;
      const scaleFactor = 1.0 + (dragDirection / 100.0) * this.scaleSensitivity;

      // Apply scaling based on plane type
      for (const entity of this.currentEntities) {
        const initialScale = initialEntityScales.get(entity.entityId);
        const offset = this.initialOffsets.get(entity.entityId);
        const initialRotation = this.initialRotations.get(entity.entityId);
        const initialPosition = this.initialPositions.get(entity.entityId);

        if (!initialScale || !offset || !initialRotation || !initialPosition) continue;

        // Calculate scale change based on plane type
        let scaleChange: Vector3;

        if (planeType === 'XY') {
          scaleChange = new Vector3(scaleFactor, scaleFactor, 1);
        } else if (planeType === 'XZ') {
          scaleChange = new Vector3(scaleFactor, 1, scaleFactor);
        } else {
          scaleChange = new Vector3(1, scaleFactor, scaleFactor); // YZ
        }
        this.applyScaleTransform(entity, scaleChange, offset, initialScale, initialRotation);

        if (this.updateEntityScale) {
          this.updateEntityScale(entity);
        }
      }
    };

    const onPointerUp = (pointerInfo: PointerInfo) => {
      if (!isDragging || pointerInfo.type !== PointerEventTypes.POINTERUP) return;

      isDragging = false;
      initialMousePos = null;
      initialEntityScales.clear();
      this.activelyDraggingPlane = null;
      this.onDragEnd();

      if (this.dispatchOperations) {
        this.dispatchOperations();
      }
    };

    const downObserver = scene.onPointerObservable.add(onPointerDown);
    const moveObserver = scene.onPointerObservable.add(onPointerMove);
    const upObserver = scene.onPointerObservable.add(onPointerUp);
    this.planePointerObservers.push(downObserver, moveObserver, upObserver);
  }

  private setPlaneMaterialsAppearance(mode: 'inactive' | 'restore', activePlane?: Mesh): void {
    for (const [mesh, matInfo] of this.planeMaterials.entries()) {
      if (mode === 'inactive' && mesh !== activePlane) {
        matInfo.material.diffuseColor = GREY_INACTIVE_COLOR;
        matInfo.material.emissiveColor = Color3.Black();
        matInfo.material.alpha = FADE_ALPHA;
      } else if (mode === 'restore') {
        matInfo.material.diffuseColor = matInfo.originalDiffuse;
        matInfo.material.emissiveColor = matInfo.originalEmissive;
        matInfo.material.alpha = FULL_ALPHA;
      }
    }
  }

  private setBuiltInGizmoAppearance(mode: 'inactive' | 'restore'): void {
    if (!this.gizmoManager.gizmos.scaleGizmo) return;
    const scaleGizmo = this.gizmoManager.gizmos.scaleGizmo as IScaleGizmo;

    const isInactive = mode === 'inactive';

    const axisConfig = [
      { gizmo: scaleGizmo.xGizmo, restoreColor: AXIS_RED },
      { gizmo: scaleGizmo.yGizmo, restoreColor: AXIS_GREEN },
      { gizmo: scaleGizmo.zGizmo, restoreColor: AXIS_BLUE },
    ];

    for (const { gizmo, restoreColor } of axisConfig) {
      if (gizmo?.coloredMaterial) {
        gizmo.coloredMaterial.diffuseColor = isInactive ? GREY_INACTIVE_COLOR : restoreColor;
        gizmo.coloredMaterial.alpha = isInactive ? FADE_ALPHA : FULL_ALPHA;
      }
    }
  }

  private configureUniformScaleGizmo(): void {
    if (!this.gizmoManager.gizmos.scaleGizmo) return;
    const scaleGizmo = this.gizmoManager.gizmos.scaleGizmo;

    const uniformGizmo = scaleGizmo.uniformScaleGizmo;
    if (!uniformGizmo) return;
    // Make the uniform scale cube 2x bigger for easier selection
    uniformGizmo.scaleRatio = 2;

    // Get the scene to create a new cube mesh
    const scene = this.gizmoManager.gizmos.scaleGizmo?._rootMesh?.getScene();
    if (!scene) return;

    // Create plane cubes (also on first activation)
    this.createPlaneCubes();
  }

  enable(): void {
    if (!this.gizmoManager.gizmos.scaleGizmo) return;

    // Setup drag observables when the gizmo is enabled
    this.setupDragObservables();

    // Configure gizmo to only work with left click
    configureGizmoButtons(this.gizmoManager.gizmos.scaleGizmo, [LEFT_BUTTON]);

    // Defer configuration to next render frame — gizmo meshes aren't fully initialized until then
    const scene = this.gizmoManager.gizmos.scaleGizmo?._rootMesh?.getScene();
    if (scene) {
      scene.onBeforeRenderObservable.addOnce(() => this.configureUniformScaleGizmo());
    }
  }

  cleanup(): void {
    if (!this.gizmoManager.gizmos.scaleGizmo) return;
    this.gizmoManager.scaleGizmoEnabled = false;

    // Clean up drag observables
    this.cleanupDragObservables();

    // Clean up plane pointer observers
    const scene = this.gizmoManager.gizmos.scaleGizmo?._rootMesh?.getScene();
    if (scene) {
      for (const observer of this.planePointerObservers) {
        scene.onPointerObservable.remove(observer);
      }
    }

    // Dispose plane cube meshes
    for (const mesh of this.planeCubeMeshes) {
      if (mesh && mesh.dispose) {
        mesh.dispose();
      }
    }
    this.planeCubeMeshes = [];
    this.planeCubesCreated = false;
    this.planePointerObservers = [];
    this.currentEntities = [];
    this.clearInitialState();
  }

  setEntities(entities: EcsEntity[]): void {
    this.currentEntities = entities;
    // Sync gizmo alignment with the new entities (always local)
    this.syncGizmoAlignment();
  }

  setUpdateCallbacks(
    updateEntityScale: (entity: EcsEntity) => void,
    dispatchOperations: () => void,
  ): void {
    this.updateEntityScale = updateEntityScale;
    this.dispatchOperations = dispatchOperations;
  }

  setWorldAligned(_value: boolean): void {
    // Scale gizmo should always be locally aligned, regardless of the parameter
    this.isWorldAligned = false;
    if (this.gizmoManager.gizmos.scaleGizmo) {
      this.gizmoManager.gizmos.scaleGizmo.updateGizmoRotationToMatchAttachedMesh = true;
    }

    // Sync gizmo alignment with the new entities (always local)
    this.syncGizmoAlignment();
  }

  setSnapDistance(distance: number): void {
    if (!this.gizmoManager.gizmos.scaleGizmo) return;
    this.gizmoManager.gizmos.scaleGizmo.snapDistance = distance;
  }

  private syncGizmoAlignment(): void {
    if (!this.gizmoManager.attachedNode || this.currentEntities.length === 0) return;

    const gizmoNode = this.gizmoManager.attachedNode as TransformNode;

    // Scale gizmo should always be locally aligned
    TransformUtils.alignGizmo(gizmoNode, this.currentEntities);
  }

  private setupDragObservables(): void {
    if (!this.gizmoManager.gizmos.scaleGizmo) return;

    const scaleGizmo = this.gizmoManager.gizmos.scaleGizmo;

    // Setup drag start
    this.dragStartObserver = scaleGizmo.onDragStartObservable.add(() => {
      if (this.gizmoManager.attachedNode) {
        this.onDragStart(this.currentEntities, this.gizmoManager.attachedNode as TransformNode);
      }
    });

    // Setup drag update
    this.dragObserver = scaleGizmo.onDragObservable.add(() => {
      if (this.gizmoManager.attachedNode) {
        this.update(this.currentEntities, this.gizmoManager.attachedNode as TransformNode);

        // Update ECS scale on each drag update for real-time feedback
        if (this.updateEntityScale) {
          this.currentEntities.forEach(this.updateEntityScale);
        }
      }
    });

    // Setup drag end
    this.dragEndObserver = scaleGizmo.onDragEndObservable.add(() => {
      this.onDragEnd();

      // Only dispatch operations at the end to avoid excessive ECS operations
      if (this.dispatchOperations) {
        this.dispatchOperations();
      }
    });
  }

  private cleanupDragObservables(): void {
    if (!this.gizmoManager.gizmos.scaleGizmo) return;

    const scaleGizmo = this.gizmoManager.gizmos.scaleGizmo;

    if (this.dragStartObserver) {
      scaleGizmo.onDragStartObservable.remove(this.dragStartObserver);
      this.dragStartObserver = null;
    }

    if (this.dragObserver) {
      scaleGizmo.onDragObservable.remove(this.dragObserver);
      this.dragObserver = null;
    }

    if (this.dragEndObserver) {
      scaleGizmo.onDragEndObservable.remove(this.dragEndObserver);
      this.dragEndObserver = null;
    }
  }

  onDragStart(entities: EcsEntity[], gizmoNode: TransformNode): void {
    if (this.isDragging) return;

    this.isDragging = true;
    this.setPlaneMaterialsAppearance('inactive');

    // Calculate pivot position (centroid of all selected entities)
    this.pivotPosition = new Vector3();
    for (const entity of entities) {
      const worldPosition = entity.getAbsolutePosition();
      this.pivotPosition.addInPlace(worldPosition);
    }
    this.pivotPosition.scaleInPlace(1 / entities.length);

    // Store initial gizmo scale
    this.initialGizmoScale = gizmoNode.scaling.clone();

    // Store initial state for all entities
    this.initialOffsets.clear();
    this.initialScales.clear();
    this.initialRotations.clear();
    this.initialPositions.clear();

    for (const entity of entities) {
      const worldPosition = entity.getAbsolutePosition();

      // Store initial transforms
      this.initialPositions.set(entity.entityId, entity.position.clone());
      this.initialScales.set(entity.entityId, entity.scaling.clone());
      this.initialRotations.set(
        entity.entityId,
        entity.rotationQuaternion?.clone() || Quaternion.Identity(),
      );

      // Store offset from pivot (for proportional scaling)
      const offset = worldPosition.subtract(this.pivotPosition);
      this.initialOffsets.set(entity.entityId, offset);
    }
  }

  update(entities: EcsEntity[], gizmoNode: TransformNode): void {
    if (!this.isDragging || !this.initialGizmoScale || !this.pivotPosition) return;

    // Calculate scale change from gizmo
    const scaleChange = new Vector3(
      gizmoNode.scaling.x / this.initialGizmoScale.x,
      gizmoNode.scaling.y / this.initialGizmoScale.y,
      gizmoNode.scaling.z / this.initialGizmoScale.z,
    );

    for (const entity of entities) {
      const offset = this.initialOffsets.get(entity.entityId);
      const initialScale = this.initialScales.get(entity.entityId);
      const initialRotation = this.initialRotations.get(entity.entityId);
      const initialPosition = this.initialPositions.get(entity.entityId);

      if (!offset || !initialScale || !initialRotation || !initialPosition) continue;

      this.applyScaleTransform(entity, scaleChange, offset, initialScale, initialRotation);
    }
  }

  /**
   * Apply scale transformation to an entity based on scale change from pivot.
   * Handles both entities with and without parents.
   */
  private applyScaleTransform(
    entity: EcsEntity,
    scaleChange: Vector3,
    offset: Vector3,
    initialScale: Vector3,
    initialRotation: Quaternion,
  ): void {
    if (!this.pivotPosition) return;

    // Scale the offset proportionally (like Blender's proportional scaling)
    const scaledOffset = new Vector3(
      offset.x * scaleChange.x,
      offset.y * scaleChange.y,
      offset.z * scaleChange.z,
    );
    const newWorldPosition = this.pivotPosition.add(scaledOffset);

    // Scale the entity's scale
    const newWorldScale = new Vector3(
      initialScale.x * scaleChange.x,
      initialScale.y * scaleChange.y,
      initialScale.z * scaleChange.z,
    );

    const parent = entity.parent instanceof TransformNode ? entity.parent : null;

    if (parent) {
      // For child entities, convert world transforms to local space
      const parentWorldMatrix = parent.getWorldMatrix();
      const parentWorldMatrixInverse = parentWorldMatrix.clone().invert();

      // Convert world position to local space
      const localPosition = Vector3.TransformCoordinates(
        newWorldPosition,
        parentWorldMatrixInverse,
      );

      // Apply scale directly to the child without considering parent's scale
      // This maintains the local scale as intended by the user
      const localScale = new Vector3(
        initialScale.x * scaleChange.x,
        initialScale.y * scaleChange.y,
        initialScale.z * scaleChange.z,
      );
      const snappedLocalScale = this.snapScale(localScale);

      // Apply transforms
      entity.position.copyFrom(localPosition);
      entity.scaling.copyFrom(snappedLocalScale);

      // Keep the initial local rotation unchanged during scaling
      // initialRotation is already in local space, so we just restore it
      if (!entity.rotationQuaternion) {
        entity.rotationQuaternion = new Quaternion();
      }
      entity.rotationQuaternion.copyFrom(initialRotation);
      entity.rotationQuaternion.normalize();
    } else {
      // For entities without parent, apply world transforms directly
      entity.position.copyFrom(newWorldPosition);
      const snappedWorldScale = this.snapScale(newWorldScale);
      entity.scaling.copyFrom(snappedWorldScale);
      if (!entity.rotationQuaternion) {
        entity.rotationQuaternion = new Quaternion();
      }
      entity.rotationQuaternion.copyFrom(initialRotation);
      entity.rotationQuaternion.normalize();
    }

    // Force update world matrix
    entity.computeWorldMatrix(true);
  }

  onDragEnd(): void {
    this.setPlaneMaterialsAppearance('restore');
    this.setBuiltInGizmoAppearance('restore');
    // Sync gizmo scale with the final snapped scales of entities
    if (this.gizmoManager.attachedNode) {
      const gizmoNode = this.gizmoManager.attachedNode as TransformNode;

      // Reset gizmo scale to identity after scaling is complete
      // This ensures the gizmo doesn't accumulate scale changes
      gizmoNode.scaling.set(1, 1, 1);

      // Scale gizmo should always be locally aligned
      TransformUtils.alignGizmo(gizmoNode, this.currentEntities);
    }

    this.clearInitialState();
  }

  private clearInitialState(): void {
    this.initialOffsets.clear();
    this.initialScales.clear();
    this.initialRotations.clear();
    this.initialPositions.clear();
    this.initialGizmoScale = null;
    this.pivotPosition = null;
    this.isDragging = false;
  }
}
