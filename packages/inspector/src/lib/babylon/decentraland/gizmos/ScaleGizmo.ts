import type { GizmoManager, Scene, Mesh } from '@babylonjs/core';
import {
  Vector3,
  TransformNode,
  Quaternion,
  Color3,
  MeshBuilder,
  PointerEventTypes,
  StandardMaterial,
} from '@babylonjs/core';
import type { Entity } from '@dcl/ecs';
import type { EcsEntity } from '../EcsEntity';
import { LEFT_BUTTON } from '../mouse-utils';
import type { IGizmoTransformer } from './types';
import { GizmoType } from './types';
import { configureGizmoButtons } from './utils';

/**
 * Creates a thin plane cube for scale gizmo planar scaling
 * @returns Tuple of [mesh, material] for the created plane
 */
function createPlane(
  scene: Scene,
  rootMesh: Mesh,
  name: string,
  width: number,
  height: number,
  depth: number,
  position: Vector3,
  diffuseColor: Color3,
  emissiveColor: Color3,
  alpha: number,
  isPickable: boolean = true,
): [Mesh, StandardMaterial] {
  const plane = MeshBuilder.CreateBox(
    `${name}Mesh`,
    {
      width: width,
      height: height,
      depth: depth,
    },
    scene,
  );
  plane.position = position;
  const material = new StandardMaterial(`${name}Mat`, scene);
  material.diffuseColor = diffuseColor;
  material.emissiveColor = emissiveColor;
  material.alpha = alpha;
  material.disableLighting = true;
  plane.material = material;
  plane.parent = rootMesh;
  plane.isPickable = isPickable;

  return [plane, material];
}

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

  // Render observer for fixing uniform scale gizmo
  private renderObserver: any = null;
  private configureAttempts = 0;
  private maxConfigureAttempts = 60; // Try for about 1 second (60 frames)

  // Custom "plane cubes" - very thin cubes that look like panels
  private planeCubesCreated = false;
  private planeCubeMeshes: any[] = []; // Store references to dispose them
  private planeMaterials: Map<any, { material: any; originalDiffuse: any; originalEmissive: any }> =
    new Map(); // Store material refs
  private activelyDraggingPlane: any = null; // Track which plane is being dragged

  constructor(
    private gizmoManager: GizmoManager,
    private snapScale: (scale: Vector3) => Vector3,
  ) {}

  setup(): void {
    if (!this.gizmoManager.gizmos.scaleGizmo) return;
    const scaleGizmo = this.gizmoManager.gizmos.scaleGizmo;
    // Scale gizmo should always be locally aligned to the entity
    scaleGizmo.updateGizmoRotationToMatchAttachedMesh = true;

    // Make the gizmo visual smaller so it doesn't scale as dramatically
    scaleGizmo.scaleRatio = 1.2; // Slightly larger for visibility but not too much

    // Note: ScaleGizmo doesn't support planar gizmos (those colored panels)
    // So we'll create custom thin cubes that look like planes!

    // Initial configuration of uniform scale gizmo
    this.configureUniformScaleGizmo();
  }

  private createPlaneCubes(): void {
    if (!this.gizmoManager.gizmos.scaleGizmo || this.planeCubesCreated) return;

    const scene = this.gizmoManager.gizmos.scaleGizmo?._rootMesh?.getScene();
    if (!scene) return;

    const rootMesh = this.gizmoManager.gizmos.scaleGizmo._rootMesh;
    if (!rootMesh) return;

    console.log('[ScaleGizmo] Creating plane cubes (thin cubes) - Blender style');

    const planeSize = 0.03; // Smaller size
    const thickness = 0.001; // Paper thin!
    const offset = 0.09; // Closer to center

    // XY Plane (light blue) - thin on Z axis, scales X and Y
    const [xyPlane, xyMaterial] = createPlane(
      scene,
      rootMesh,
      'scalePlaneXY',
      planeSize,
      planeSize,
      thickness,
      new Vector3(offset, offset, 0),
      new Color3(0.5, 0.7, 1.0), // Light blue (Blender style)
      new Color3(0.3, 0.4, 0.6), // Slight glow
      0.7,
      true,
    );

    // XZ Plane (light green) - thin on Y axis, scales X and Z
    const [xzPlane, xzMaterial] = createPlane(
      scene,
      rootMesh,
      'scalePlaneXZ',
      planeSize,
      thickness,
      planeSize,
      new Vector3(offset, 0, offset),
      new Color3(0.5, 1.0, 0.5), // Light green (Blender style)
      new Color3(0.3, 0.6, 0.3), // Slight glow
      0.7,
      true,
    );

    // YZ Plane (light red) - thin on X axis, scales Y and Z
    const [yzPlane, yzMaterial] = createPlane(
      scene,
      rootMesh,
      'scalePlaneYZ',
      thickness,
      planeSize,
      planeSize,
      new Vector3(0, offset, offset),
      new Color3(1.0, 0.5, 0.5), // Light red (Blender style)
      new Color3(0.6, 0.3, 0.3), // Slight glow
      0.7,
      true,
    );

    // Store references for disposal later
    this.planeCubeMeshes.push(xyPlane, xzPlane, yzPlane);

    // Store material references
    this.planeMaterials.set(xyPlane, {
      material: xyMaterial,
      originalDiffuse: new Color3(0.5, 0.7, 1.0),
      originalEmissive: new Color3(0.3, 0.4, 0.6),
    });
    this.planeMaterials.set(xzPlane, {
      material: xzMaterial,
      originalDiffuse: new Color3(0.5, 1.0, 0.5),
      originalEmissive: new Color3(0.3, 0.6, 0.3),
    });
    this.planeMaterials.set(yzPlane, {
      material: yzMaterial,
      originalDiffuse: new Color3(1.0, 0.5, 0.5),
      originalEmissive: new Color3(0.6, 0.3, 0.3),
    });

    // Add hover behavior (yellow highlight like other gizmos)
    this.addPlaneHoverBehavior(xyPlane);
    this.addPlaneHoverBehavior(xzPlane);
    this.addPlaneHoverBehavior(yzPlane);

    // Add drag behavior to the planes for 2-axis scaling
    this.addPlaneDragBehavior(xyPlane, 'XY'); // Scales X and Y
    this.addPlaneDragBehavior(xzPlane, 'XZ'); // Scales X and Z
    this.addPlaneDragBehavior(yzPlane, 'YZ'); // Scales Y and Z

    this.planeCubesCreated = true;
    console.log('[ScaleGizmo] Plane cubes created successfully');
  }

  private addPlaneHoverBehavior(planeMesh: any): void {
    const scene = planeMesh.getScene();
    const matInfo = this.planeMaterials.get(planeMesh);
    if (!matInfo) return;

    // Yellow color for hover (matching other gizmos)
    const hoverDiffuse = new Color3(1.0, 1.0, 0.0); // Bright yellow
    const hoverEmissive = new Color3(0.8, 0.8, 0.0); // Yellow glow

    const onPointerEnter = (pointerInfo: any) => {
      if (pointerInfo.type !== PointerEventTypes.POINTERMOVE) return;

      const pickInfo = pointerInfo.pickInfo;
      if (!pickInfo || !pickInfo.hit || pickInfo.pickedMesh !== planeMesh) return;

      // Don't change color if we're actively dragging something else
      if (this.activelyDraggingPlane && this.activelyDraggingPlane !== planeMesh) return;

      // Change to yellow on hover (unless this plane is being dragged)
      if (!this.activelyDraggingPlane) {
        matInfo.material.diffuseColor = hoverDiffuse;
        matInfo.material.emissiveColor = hoverEmissive;
      }
    };

    const onPointerExit = (pointerInfo: any) => {
      if (pointerInfo.type !== PointerEventTypes.POINTERMOVE) return;

      const pickInfo = pointerInfo.pickInfo;

      // If we're no longer hovering this mesh, restore original color
      // (unless we're actively dragging this plane - it should stay yellow)
      if (
        (!pickInfo || !pickInfo.hit || pickInfo.pickedMesh !== planeMesh) &&
        this.activelyDraggingPlane !== planeMesh
      ) {
        matInfo.material.diffuseColor = matInfo.originalDiffuse;
        matInfo.material.emissiveColor = matInfo.originalEmissive;
      }
    };

    // Add observers for hover detection
    scene.onPointerObservable.add(onPointerEnter);
    scene.onPointerObservable.add(onPointerExit);
  }

  private addPlaneDragBehavior(planeMesh: any, planeType: 'XY' | 'XZ' | 'YZ'): void {
    const scene = planeMesh.getScene();

    let isDragging = false;
    let initialMousePos: { x: number; y: number } | null = null;
    const initialEntityScales = new Map<any, any>();

    const onPointerDown = (pointerInfo: any) => {
      if (pointerInfo.type !== PointerEventTypes.POINTERDOWN) return;

      const pickInfo = pointerInfo.pickInfo;
      if (!pickInfo || !pickInfo.hit || pickInfo.pickedMesh !== planeMesh) return;

      // Check for left button (button 0)
      if (pointerInfo.event.button !== 0) return;

      console.log(`[ScaleGizmo] Starting ${planeType} plane drag`);
      isDragging = true;
      initialMousePos = { x: pointerInfo.event.clientX, y: pointerInfo.event.clientY };

      // Mark this plane as actively dragging
      this.activelyDraggingPlane = planeMesh;

      // Keep this plane yellow during drag
      const matInfo = this.planeMaterials.get(planeMesh);
      if (matInfo) {
        matInfo.material.diffuseColor = new Color3(1.0, 1.0, 0.0); // Yellow
        matInfo.material.emissiveColor = new Color3(0.8, 0.8, 0.0); // Yellow glow
      }

      // Grey out all other gizmo parts
      console.log('[ScaleGizmo] Plane drag start - greying out other gizmos');
      this.setOtherGizmosInactive(planeMesh);

      // Store initial scales for all entities
      initialEntityScales.clear();
      for (const entity of this.currentEntities) {
        initialEntityScales.set(entity.entityId, entity.scaling.clone());
      }

      this.onDragStart(this.currentEntities, this.gizmoManager.attachedNode as any);
    };

    const onPointerMove = (pointerInfo: any) => {
      if (!isDragging || !initialMousePos || pointerInfo.type !== PointerEventTypes.POINTERMOVE)
        return;

      const currentMousePos = { x: pointerInfo.event.clientX, y: pointerInfo.event.clientY };
      const deltaX = currentMousePos.x - initialMousePos.x;
      const deltaY = currentMousePos.y - initialMousePos.y;

      // Use the drag direction for scaling
      const dragDirection = deltaX + deltaY; // Positive = scale up, negative = scale down
      const scaleFactor = 1.0 + (dragDirection / 100.0) * this.scaleSensitivity;

      // Apply scaling based on plane type (Blender behavior)
      for (const entity of this.currentEntities) {
        const initialScale = initialEntityScales.get(entity.entityId);
        if (!initialScale) continue;

        let newScale: Vector3;

        if (planeType === 'XY') {
          // Scale X and Y, keep Z unchanged
          newScale = new Vector3(
            initialScale.x * scaleFactor,
            initialScale.y * scaleFactor,
            initialScale.z, // Z unchanged
          );
        } else if (planeType === 'XZ') {
          // Scale X and Z, keep Y unchanged
          newScale = new Vector3(
            initialScale.x * scaleFactor,
            initialScale.y, // Y unchanged
            initialScale.z * scaleFactor,
          );
        } else {
          // YZ
          // Scale Y and Z, keep X unchanged
          newScale = new Vector3(
            initialScale.x, // X unchanged
            initialScale.y * scaleFactor,
            initialScale.z * scaleFactor,
          );
        }

        entity.scaling.copyFrom(newScale);
        entity.computeWorldMatrix(true);

        if (this.updateEntityScale) {
          this.updateEntityScale(entity);
        }
      }
    };

    const onPointerUp = (pointerInfo: any) => {
      if (!isDragging || pointerInfo.type !== PointerEventTypes.POINTERUP) return;

      console.log(`[ScaleGizmo] Ending ${planeType} plane drag`);
      isDragging = false;
      initialMousePos = null;
      initialEntityScales.clear();

      // Clear actively dragging state
      this.activelyDraggingPlane = null;

      // Restore all gizmo colors
      this.restoreAllGizmoColors();

      this.onDragEnd();

      if (this.dispatchOperations) {
        this.dispatchOperations();
      }
    };

    // Register observers
    scene.onPointerObservable.add(onPointerDown);
    scene.onPointerObservable.add(onPointerMove);
    scene.onPointerObservable.add(onPointerUp);
  }

  private setOtherGizmosInactive(activePlane: any): void {
    console.log('[ScaleGizmo] Fading out other plane cubes and built-in gizmos');
    const greyColor = new Color3(0.8, 0.8, 0.8); // Light grey/white
    const fadeAlpha = 0.5;

    // Fade out other plane cubes (not the active one) - change color AND alpha
    for (const [mesh, matInfo] of this.planeMaterials.entries()) {
      if (mesh !== activePlane) {
        matInfo.material.diffuseColor = greyColor;
        matInfo.material.emissiveColor = Color3.Black();
        matInfo.material.alpha = fadeAlpha;
      }
    }

    // Grey out built-in gizmo parts (X/Y/Z axes and uniform scale cube)
    this.greyOutBuiltInGizmos();
  }

  private greyOutBuiltInGizmos(): void {
    if (!this.gizmoManager.gizmos.scaleGizmo) return;

    console.log('[ScaleGizmo] Greying out built-in gizmo parts');
    const scaleGizmo = this.gizmoManager.gizmos.scaleGizmo as any;

    // Change color to white/grey AND fade
    const greyColor = new Color3(0.8, 0.8, 0.8); // Light grey/white
    const fadeAlpha = 0.5;

    // Grey out X, Y, Z axis gizmos - change color AND alpha
    if (scaleGizmo.xGizmo?._coloredMaterial) {
      scaleGizmo.xGizmo._coloredMaterial.diffuseColor = greyColor;
      scaleGizmo.xGizmo._coloredMaterial.alpha = fadeAlpha;
    }
    if (scaleGizmo.yGizmo?._coloredMaterial) {
      scaleGizmo.yGizmo._coloredMaterial.diffuseColor = greyColor;
      scaleGizmo.yGizmo._coloredMaterial.alpha = fadeAlpha;
    }
    if (scaleGizmo.zGizmo?._coloredMaterial) {
      scaleGizmo.zGizmo._coloredMaterial.diffuseColor = greyColor;
      scaleGizmo.zGizmo._coloredMaterial.alpha = fadeAlpha;
    }

    // Grey out uniform scale gizmo
    if (scaleGizmo.uniformScaleGizmo?._coloredMaterial) {
      scaleGizmo.uniformScaleGizmo._coloredMaterial.diffuseColor = greyColor;
      scaleGizmo.uniformScaleGizmo._coloredMaterial.alpha = fadeAlpha;
    }
  }

  private restoreBuiltInGizmoColors(): void {
    if (!this.gizmoManager.gizmos.scaleGizmo) return;

    console.log('[ScaleGizmo] Restoring built-in gizmo parts');
    const scaleGizmo = this.gizmoManager.gizmos.scaleGizmo as any;

    // Restore original colors and full alpha
    const fullAlpha = 1.0;

    // Restore X, Y, Z axis gizmos to their original red/green/blue
    if (scaleGizmo.xGizmo?._coloredMaterial) {
      scaleGizmo.xGizmo._coloredMaterial.diffuseColor = new Color3(1, 0, 0); // Red
      scaleGizmo.xGizmo._coloredMaterial.alpha = fullAlpha;
    }
    if (scaleGizmo.yGizmo?._coloredMaterial) {
      scaleGizmo.yGizmo._coloredMaterial.diffuseColor = new Color3(0, 1, 0); // Green
      scaleGizmo.yGizmo._coloredMaterial.alpha = fullAlpha;
    }
    if (scaleGizmo.zGizmo?._coloredMaterial) {
      scaleGizmo.zGizmo._coloredMaterial.diffuseColor = new Color3(0, 0, 1); // Blue
      scaleGizmo.zGizmo._coloredMaterial.alpha = fullAlpha;
    }

    // Restore uniform scale gizmo to white
    if (scaleGizmo.uniformScaleGizmo?._coloredMaterial) {
      scaleGizmo.uniformScaleGizmo._coloredMaterial.diffuseColor = new Color3(1, 1, 1); // White
      scaleGizmo.uniformScaleGizmo._coloredMaterial.alpha = fullAlpha;
    }
  }

  private setPlaneGizmosInactive(): void {
    console.log('[ScaleGizmo] Fading out plane cubes');
    const greyColor = new Color3(0.8, 0.8, 0.8); // Light grey/white
    const fadeAlpha = 0.5;

    // Fade out all plane cubes when built-in gizmo parts are being used - change color AND alpha
    for (const [_mesh, matInfo] of this.planeMaterials.entries()) {
      matInfo.material.diffuseColor = greyColor;
      matInfo.material.emissiveColor = Color3.Black();
      matInfo.material.alpha = fadeAlpha;
    }
  }

  private restoreAllGizmoColors(): void {
    console.log('[ScaleGizmo] Restoring all plane cubes and built-in gizmos');
    const fullAlpha = 0.7; // Original alpha for plane cubes (they have some transparency)

    // Restore all plane cube alpha to full
    for (const [_mesh, matInfo] of this.planeMaterials.entries()) {
      matInfo.material.alpha = fullAlpha;
      // Also restore original colors
      matInfo.material.diffuseColor = matInfo.originalDiffuse;
      matInfo.material.emissiveColor = matInfo.originalEmissive;
    }

    // Restore built-in gizmo colors
    this.restoreBuiltInGizmoColors();
  }

  private configureUniformScaleGizmo(): void {
    if (!this.gizmoManager.gizmos.scaleGizmo) return;
    const scaleGizmo = this.gizmoManager.gizmos.scaleGizmo;

    // Configure the uniform scale gizmo (replace hexagonal prism with cube)
    const uniformGizmo = (scaleGizmo as any).uniformScaleGizmo;
    if (!uniformGizmo) return;

    let meshConfigured = false;

    // Make the uniform scale cube 3x bigger for easier selection
    uniformGizmo.scaleRatio = 3.0;

    // Get the scene to create a new cube mesh
    const scene = this.gizmoManager.gizmos.scaleGizmo?._rootMesh?.getScene();
    if (!scene) return;

    // Try to replace the hexagonal prism with a proper cube
    const existingMesh = uniformGizmo._gizmoMesh || uniformGizmo._rootMesh;
    if (existingMesh && !uniformGizmo._customMeshSet) {
      console.log('[ScaleGizmo] Replacing hexagonal prism with cube');

      // Create a proper cube to replace the hexagonal prism (15% smaller)
      const cubeSize = 0.0102; // 0.012 * 0.85 = 15% smaller
      const customCube = MeshBuilder.CreateBox(
        'uniformScaleCube',
        {
          size: cubeSize,
        },
        scene,
      );

      // Create a white/yellow material like the original gizmo
      const material = new StandardMaterial('uniformScaleCubeMat', scene);
      material.diffuseColor = new Color3(1, 1, 1); // White
      material.emissiveColor = new Color3(0.8, 0.8, 0.5); // Slight yellow glow
      material.disableLighting = true; // Don't be affected by scene lights
      material.alpha = 0.9; // Slight transparency
      customCube.material = material;

      // Try to set the custom mesh using Babylon's setCustomMesh if it exists
      if (typeof uniformGizmo.setCustomMesh === 'function') {
        uniformGizmo.setCustomMesh(customCube);
        console.log('[ScaleGizmo] Custom cube mesh set successfully');
        uniformGizmo._customMeshSet = true;
        meshConfigured = true;
      } else {
        // Fallback: manually replace the mesh
        console.log('[ScaleGizmo] Manually replacing mesh');

        // Dispose the old mesh
        if (existingMesh.dispose) {
          existingMesh.dispose();
        }

        // Set the new cube as the gizmo mesh
        uniformGizmo._gizmoMesh = customCube;
        uniformGizmo._rootMesh = customCube;
        uniformGizmo._customMeshSet = true;
        meshConfigured = true;
      }
    }

    // Create plane cubes (also on first activation)
    this.createPlaneCubes();

    // Stop the render observer if we successfully configured the mesh
    if (meshConfigured && this.renderObserver) {
      this.stopConfigureObserver();
    }
  }

  private startConfigureObserver(): void {
    if (this.renderObserver) return; // Already running

    const scene = this.gizmoManager.gizmos.scaleGizmo?._rootMesh?.getScene();
    if (!scene) return;

    this.configureAttempts = 0;

    // Set up a render observer that tries to configure every frame
    this.renderObserver = scene.onBeforeRenderObservable.add(() => {
      this.configureAttempts++;

      // Try to configure
      this.configureUniformScaleGizmo();

      // Stop after max attempts to avoid infinite loop
      if (this.configureAttempts >= this.maxConfigureAttempts) {
        this.stopConfigureObserver();
      }
    });
  }

  private stopConfigureObserver(): void {
    if (this.renderObserver) {
      const scene = this.gizmoManager.gizmos.scaleGizmo?._rootMesh?.getScene();
      if (scene) {
        scene.onBeforeRenderObservable.remove(this.renderObserver);
      }
      this.renderObserver = null;
      this.configureAttempts = 0;
    }
  }

  enable(): void {
    if (!this.gizmoManager.gizmos.scaleGizmo) return;

    // Setup drag observables when the gizmo is enabled
    this.setupDragObservables();

    // Configure gizmo to only work with left click
    configureGizmoButtons(this.gizmoManager.gizmos.scaleGizmo, [LEFT_BUTTON]);

    // Start the render observer to continuously try configuring until mesh is found
    this.startConfigureObserver();
  }

  cleanup(): void {
    if (!this.gizmoManager.gizmos.scaleGizmo) return;
    this.gizmoManager.scaleGizmoEnabled = false;

    // Clean up drag observables
    this.cleanupDragObservables();

    // Clean up render observer
    this.stopConfigureObserver();

    // Dispose plane cube meshes
    console.log('[ScaleGizmo] Disposing plane cube meshes:', this.planeCubeMeshes.length);
    for (const mesh of this.planeCubeMeshes) {
      if (mesh && mesh.dispose) {
        mesh.dispose();
      }
    }
    this.planeCubeMeshes = [];
    this.planeCubesCreated = false;

    this.initialOffsets.clear();
    this.initialScales.clear();
    this.initialRotations.clear();
    this.initialPositions.clear();
    this.initialGizmoScale = null;
    this.pivotPosition = null;
    this.isDragging = false;
    this.currentEntities = [];
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
    if (this.currentEntities.length === 1) {
      const entity = this.currentEntities[0];
      if (entity.rotationQuaternion && gizmoNode.rotationQuaternion) {
        // If the entity has a parent, convert to world rotation
        if (entity.parent && entity.parent instanceof TransformNode) {
          const parent = entity.parent as TransformNode;
          const parentWorldRotation =
            parent.rotationQuaternion || Quaternion.FromRotationMatrix(parent.getWorldMatrix());
          const worldRotation = parentWorldRotation.multiply(entity.rotationQuaternion);
          gizmoNode.rotationQuaternion.copyFrom(worldRotation);
        } else {
          // If no parent, apply directly
          gizmoNode.rotationQuaternion.copyFrom(entity.rotationQuaternion);
        }
      }
    } else {
      // For multiple entities, always reset to identity rotation
      // This provides a consistent reference point for scaling operations
      if (gizmoNode.rotationQuaternion) {
        gizmoNode.rotationQuaternion.set(0, 0, 0, 1); // Quaternion.Identity()
      }
    }

    gizmoNode.computeWorldMatrix(true);
  }

  private setupDragObservables(): void {
    if (!this.gizmoManager.gizmos.scaleGizmo) return;

    const scaleGizmo = this.gizmoManager.gizmos.scaleGizmo;

    // Setup drag start
    this.dragStartObserver = scaleGizmo.onDragStartObservable.add(() => {
      console.log('[ScaleGizmo] Scale drag start - greying out plane cubes');

      // Grey out plane cubes when built-in gizmo parts are being used
      this.setPlaneGizmosInactive();

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
      console.log('[ScaleGizmo] Scale drag end');

      // Restore plane cube colors when built-in gizmo drag ends
      this.restoreAllGizmoColors();

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
    const rawScaleChange = new Vector3(
      gizmoNode.scaling.x / this.initialGizmoScale.x,
      gizmoNode.scaling.y / this.initialGizmoScale.y,
      gizmoNode.scaling.z / this.initialGizmoScale.z,
    );

    // Apply sensitivity multiplier to make scaling more responsive
    // Formula: 1 + (change - 1) * sensitivity
    // This amplifies the scaling effect while keeping 1.0 as the neutral point
    const scaleChange = new Vector3(
      1 + (rawScaleChange.x - 1) * this.scaleSensitivity,
      1 + (rawScaleChange.y - 1) * this.scaleSensitivity,
      1 + (rawScaleChange.z - 1) * this.scaleSensitivity,
    );

    for (const entity of entities) {
      const offset = this.initialOffsets.get(entity.entityId);
      const initialScale = this.initialScales.get(entity.entityId);
      const initialRotation = this.initialRotations.get(entity.entityId);
      const initialPosition = this.initialPositions.get(entity.entityId);

      if (!offset || !initialScale || !initialRotation || !initialPosition) continue;

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
        const parentWorldRotation =
          parent.rotationQuaternion || Quaternion.FromRotationMatrix(parentWorldMatrix);

        // Convert world position to local space
        const localPosition = Vector3.TransformCoordinates(
          newWorldPosition,
          parentWorldMatrixInverse,
        );

        // Convert world rotation to local space
        const localRotation = parentWorldRotation.invert().multiply(initialRotation);

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
        if (!entity.rotationQuaternion) {
          entity.rotationQuaternion = new Quaternion();
        }
        entity.rotationQuaternion.copyFrom(localRotation);
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
  }

  onDragEnd(): void {
    // Sync gizmo scale with the final snapped scales of entities
    if (this.gizmoManager.attachedNode) {
      const gizmoNode = this.gizmoManager.attachedNode as TransformNode;

      // Reset gizmo scale to identity after scaling is complete
      // This ensures the gizmo doesn't accumulate scale changes
      gizmoNode.scaling.set(1, 1, 1);

      // Scale gizmo should always be locally aligned
      if (this.currentEntities.length === 1) {
        const entity = this.currentEntities[0];
        if (entity.rotationQuaternion && gizmoNode.rotationQuaternion) {
          // If the entity has a parent, convert to world rotation
          if (entity.parent && entity.parent instanceof TransformNode) {
            const parent = entity.parent as TransformNode;
            const parentWorldRotation =
              parent.rotationQuaternion || Quaternion.FromRotationMatrix(parent.getWorldMatrix());
            const worldRotation = parentWorldRotation.multiply(entity.rotationQuaternion);
            gizmoNode.rotationQuaternion.copyFrom(worldRotation);
          } else {
            // If no parent, apply directly
            gizmoNode.rotationQuaternion.copyFrom(entity.rotationQuaternion);
          }
        }
      } else {
        // For multiple entities, always reset to identity rotation
        // This provides a consistent reference point for scaling operations
        if (gizmoNode.rotationQuaternion) {
          gizmoNode.rotationQuaternion.set(0, 0, 0, 1); // Quaternion.Identity()
        }
      }

      gizmoNode.computeWorldMatrix(true);
    }

    this.isDragging = false;
    this.initialGizmoScale = null;
    this.pivotPosition = null;
    this.initialOffsets.clear();
    this.initialScales.clear();
    this.initialRotations.clear();
    this.initialPositions.clear();
  }
}
