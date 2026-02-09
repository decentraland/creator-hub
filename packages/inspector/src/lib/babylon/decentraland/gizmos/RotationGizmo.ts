import type { GizmoManager, Nullable, IRotationGizmo } from '@babylonjs/core';
import {
  Vector3,
  TransformNode,
  Quaternion,
  Matrix,
  Color3,
  ShaderMaterial,
  Effect,
  Mesh,
  MeshBuilder,
  VertexBuffer,
  VertexData,
  Material,
  type Scene,
  type Observer,
} from '@babylonjs/core';
import type { Entity } from '@dcl/ecs';
import type { EcsEntity } from '../EcsEntity';
import { snapManager } from '../snap-manager';
import { LEFT_BUTTON } from '../mouse-utils';
import type { IGizmoTransformer } from './types';
import { GizmoType } from './types';
import { configureGizmoButtons } from './utils';

// Depth cues: outward-facing side of each loop brighter, inward-facing duller
const DEPTH_CUE_VERTEX_SHADER = `
  precision highp float;
  attribute vec3 position;
  uniform mat4 worldViewProjection;
  uniform mat4 world;
  varying vec3 vWorldPos;
  void main() {
    gl_Position = worldViewProjection * vec4(position, 1.0);
    vWorldPos = (world * vec4(position, 1.0)).xyz;
  }
`;

const DEPTH_CUE_FRAGMENT_SHADER = `
  precision highp float;
  varying vec3 vWorldPos;
  uniform vec3 baseColor;
  uniform vec3 cameraPosition;
  uniform vec3 gizmoCenter;
  uniform float alpha;
  void main() {
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 toFragment = vWorldPos - gizmoCenter;
    float dist = length(toFragment);
    if (dist < 0.001) { gl_FragColor = vec4(baseColor, alpha); return; }
    toFragment /= dist;
    float frontBack = dot(toFragment, V);
    // Facing goes 0 (far side) -> 1 (near side). We fade alpha rather than darken color.
    float facing = smoothstep(-0.4, 0.2, frontBack);
    gl_FragColor = vec4(baseColor, alpha * facing);
  }
`;

// Types for better type safety
type EntityTransformData = {
  initialRotation: Quaternion;
  offset?: Vector3;
};

type DragState = {
  startRotation: Quaternion;
  entities: EcsEntity[];
  transformData: Map<Entity, EntityTransformData>;
  multiTransform?: TransformNode;
  lastAppliedSnapAngle?: number; // Track the last applied snap angle for smooth snapping
  initialGizmoRotation?: Quaternion; // Store initial gizmo rotation for world-aligned drag
};

type AxisDepthCueData = {
  rotationMesh: Mesh;
  coloredMaterial: unknown;
  hoverMaterial: unknown;
  disableMaterial: unknown;
  depthCueColored: ShaderMaterial;
  depthCueHover: ShaderMaterial;
  depthCueDisable: ShaderMaterial;
};

// Visual/picking config: make the rotation rings easier to hit without changing their diameter
const ROTATION_RING_THICKNESS_MULTIPLIER = 2.25;

// Helper class for entity rotation calculations
class EntityRotationHelper {
  static getWorldRotation(entity: EcsEntity): Quaternion {
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

  static getLocalRotation(worldRotation: Quaternion, parent: TransformNode | null): Quaternion {
    if (!parent) return worldRotation.clone();

    const parentWorldRotation =
      parent.rotationQuaternion || Quaternion.FromRotationMatrix(parent.getWorldMatrix());

    return parentWorldRotation.invert().multiply(worldRotation);
  }

  static applyRotationToEntity(
    entity: EcsEntity,
    rotation: Quaternion,
    isWorldAligned: boolean,
  ): void {
    if (!entity.rotationQuaternion) {
      entity.rotationQuaternion = new Quaternion();
    }

    if (isWorldAligned && entity.parent && entity.parent instanceof TransformNode) {
      const localRotation = this.getLocalRotation(rotation, entity.parent as TransformNode);
      entity.rotationQuaternion.copyFrom(localRotation);
    } else {
      entity.rotationQuaternion.copyFrom(rotation);
    }

    // Force update world matrix
    entity.computeWorldMatrix(true);
  }
}

// Helper class for multi-entity operations
class MultiEntityHelper {
  static calculateCentroid(entities: EcsEntity[]): Vector3 {
    if (entities.length === 0) return Vector3.Zero();

    const sum = entities.reduce((acc, entity) => {
      return acc.add(entity.getAbsolutePosition());
    }, Vector3.Zero());

    return sum.scale(1 / entities.length);
  }

  static createMultiTransform(centroid: Vector3, scene: any): TransformNode {
    const multiTransform = new TransformNode('multiTransform', scene);
    multiTransform.position = centroid;
    multiTransform.rotationQuaternion = Quaternion.Identity();
    return multiTransform;
  }

  static calculateRotatedPosition(
    offset: Vector3,
    rotationDelta: Quaternion,
    centroid: Vector3,
  ): Vector3 {
    const rotationMatrix = new Matrix();
    rotationDelta.toRotationMatrix(rotationMatrix);
    const rotatedOffset = Vector3.TransformCoordinates(offset, rotationMatrix);
    return centroid.add(rotatedOffset);
  }
}

// Helper class for gizmo synchronization
class GizmoSyncHelper {
  static syncGizmoRotation(
    gizmoNode: TransformNode,
    entities: EcsEntity[],
    isWorldAligned: boolean,
  ): void {
    if (entities.length === 0) return;

    if (isWorldAligned) {
      // World aligned: reset to identity rotation
      if (gizmoNode.rotationQuaternion) {
        gizmoNode.rotationQuaternion.set(0, 0, 0, 1);
      }
    } else {
      // Local aligned: sync with the first entity's rotation (if single entity)
      if (entities.length === 1) {
        const entity = entities[0];
        if (entity.rotationQuaternion && gizmoNode.rotationQuaternion) {
          const worldRotation = EntityRotationHelper.getWorldRotation(entity);
          gizmoNode.rotationQuaternion.copyFrom(worldRotation);
        }
      } else {
        // For multiple entities, always reset to identity rotation
        if (gizmoNode.rotationQuaternion) {
          gizmoNode.rotationQuaternion.set(0, 0, 0, 1);
        }
      }
    }

    gizmoNode.computeWorldMatrix(true);
  }
}

// Helper class for smooth snapping calculations
class SmoothSnapHelper {
  static getRotationAngle(quaternion: Quaternion): number {
    const normalized = quaternion.normalize();
    const { w } = normalized;

    // For very small rotations, return 0
    if (Math.abs(w) > 0.9999) {
      return 0;
    }

    return 2 * Math.acos(Math.abs(w));
  }

  static shouldApplySnap(
    currentAngle: number,
    lastAppliedAngle: number | undefined,
    snapThreshold: number,
  ): boolean {
    // If snapping is disabled, always apply rotation immediately
    if (!snapManager.isEnabled()) {
      return true;
    }

    if (lastAppliedAngle === undefined) {
      // First time, apply snap if we've moved significantly
      return Math.abs(currentAngle) >= snapThreshold * 0.5;
    }

    // Check if we've moved enough to warrant a new snap
    const angleDifference = Math.abs(currentAngle - lastAppliedAngle);
    return angleDifference >= snapThreshold;
  }

  static getSnapThreshold(): number {
    // Get snap threshold in radians from the snap manager
    return snapManager.getRotationSnap();
  }

  static isSnapEnabled(): boolean {
    return snapManager.isEnabled();
  }
}

export class RotationGizmo implements IGizmoTransformer {
  type = GizmoType.ROTATION;
  private rotationGizmo: Nullable<IRotationGizmo> = null;
  private currentEntities: EcsEntity[] = [];
  private currentEntityIds = new Set<Entity>();
  private dragState: DragState | null = null;

  // Observers
  private dragStartObserver: any = null;
  private dragObserver: any = null;
  private dragEndObserver: any = null;

  // Callbacks
  private updateEntityRotation: ((entity: EcsEntity) => void) | null = null;
  private updateEntityPosition: ((entity: EcsEntity) => void) | null = null;
  private dispatchOperations: (() => void) | null = null;

  // Configuration
  private isWorldAligned = true;
  private sceneContext: any = null;

  // Store original materials for customization
  private originalMaterials: Map<any, { colored: any; hover: any }> = new Map();

  // Depth-cue: outward-facing side of each loop brighter, inward duller
  private depthCueAxisData: AxisDepthCueData[] = [];
  private beforeRenderObserver: Nullable<Observer<Scene>> = null;

  constructor(
    private gizmoManager: GizmoManager,
    private snapRotation: (rotation: Quaternion) => Quaternion,
  ) {}

  setup(): void {
    if (!this.gizmoManager.gizmos.rotationGizmo) return;

    this.rotationGizmo = this.gizmoManager.gizmos.rotationGizmo;
    this.rotationGizmo.updateGizmoRotationToMatchAttachedMesh = !this.isWorldAligned;
  }

  private customizeGizmoAppearance(): void {
    if (!this.rotationGizmo) return;

    // Access axis gizmos (xGizmo, yGizmo, zGizmo) - these are public properties
    const axisGizmos = [
      this.rotationGizmo.xGizmo,
      this.rotationGizmo.yGizmo,
      this.rotationGizmo.zGizmo,
    ];

    for (const gizmo of axisGizmos) {
      if (!gizmo) continue;

      // Access public material properties
      const coloredMaterial = gizmo.coloredMaterial;
      const hoverMaterial = gizmo.hoverMaterial;

      if (coloredMaterial && hoverMaterial) {
        // Store original materials for reference
        this.originalMaterials.set(gizmo, {
          colored: coloredMaterial,
          hover: hoverMaterial,
        });

        // Customize hover material to be brighter/thicker instead of yellow
        // Preserve original color but make it brighter and more emissive
        const originalColor = coloredMaterial.diffuseColor || new Color3(1, 1, 1);
        const originalEmissive = coloredMaterial.emissiveColor || new Color3(0, 0, 0);

        // Make hover color brighter (1.5x) while preserving the original color
        hoverMaterial.diffuseColor = new Color3(
          Math.min(1, originalColor.r * 1.5),
          Math.min(1, originalColor.g * 1.5),
          Math.min(1, originalColor.b * 1.5),
        );

        // Increase emissive to make it appear thicker/brighter
        hoverMaterial.emissiveColor = new Color3(
          Math.min(1, originalEmissive.r + originalColor.r * 0.6),
          Math.min(1, originalEmissive.g + originalColor.g * 0.6),
          Math.min(1, originalEmissive.b + originalColor.b * 0.6),
        );
      }
    }
  }

  private thickenRotationLoops(): void {
    if (!this.rotationGizmo) return;

    const axisGizmos = [
      this.rotationGizmo.xGizmo,
      this.rotationGizmo.yGizmo,
      this.rotationGizmo.zGizmo,
    ];

    for (const gizmo of axisGizmos) {
      if (!gizmo) continue;

      const plane = gizmo as { _gizmoMesh?: Mesh };
      const gizmoMesh = plane._gizmoMesh;
      if (!gizmoMesh) continue;

      // Babylon's rotation gizmo usually has multiple children (visible ring + optional collider ring).
      // We detect ring-like (torus-ish) meshes and rebuild their geometry with a thicker tube.
      const children = gizmoMesh.getChildMeshes(false).filter((m): m is Mesh => m instanceof Mesh);
      for (const child of children) {
        if (!child.isVerticesDataPresent(VertexBuffer.PositionKind)) continue;

        child.computeWorldMatrix(true);
        child.refreshBoundingInfo(true);
        const ext = child.getBoundingInfo().boundingBox.extendSize;
        if (!this.isLikelyRotationRing(ext)) continue;

        this.rebuildTorusLikeMeshWithThickerTube(child, ROTATION_RING_THICKNESS_MULTIPLIER);
      }
    }
  }

  private isLikelyRotationRing(ext: Vector3): boolean {
    // A torus ring (in local space) is "flat": one axis is much smaller than the other two,
    // and the two large extents are roughly equal.
    const values = [ext.x, ext.y, ext.z].sort((a, b) => a - b);
    const [minE, midE, maxE] = values;
    if (!Number.isFinite(minE) || !Number.isFinite(midE) || !Number.isFinite(maxE)) return false;
    if (minE <= 0 || midE <= 0 || maxE <= 0) return false;

    const largeSimilar = Math.abs(maxE - midE) / maxE < 0.2;
    const flatEnough = minE / midE < 0.45;
    const bigEnough = midE > 0.05;
    return largeSimilar && flatEnough && bigEnough;
  }

  private getSmallestExtentAxisIndex(ext: Vector3): 0 | 1 | 2 {
    if (ext.x <= ext.y && ext.x <= ext.z) return 0;
    if (ext.y <= ext.x && ext.y <= ext.z) return 1;
    return 2;
  }

  private axisVectorFromIndex(index: 0 | 1 | 2): Vector3 {
    if (index === 0) return Vector3.Right();
    if (index === 1) return Vector3.Up();
    return Vector3.Forward();
  }

  private quaternionFromTo(from: Vector3, to: Vector3): Quaternion {
    const f = from.clone().normalize();
    const t = to.clone().normalize();
    const dot = Vector3.Dot(f, t);

    if (dot > 0.999999) return Quaternion.Identity();

    if (dot < -0.999999) {
      // 180° rotation; pick an arbitrary orthogonal axis
      const arbitrary = Math.abs(f.x) < 0.1 ? Vector3.Right() : Vector3.Up();
      const axis = Vector3.Cross(f, arbitrary).normalize();
      return Quaternion.RotationAxis(axis, Math.PI);
    }

    const axis = Vector3.Cross(f, t);
    const s = Math.sqrt((1 + dot) * 2);
    const invs = 1 / s;
    return new Quaternion(axis.x * invs, axis.y * invs, axis.z * invs, s * 0.5);
  }

  private estimateTessellation(mesh: Mesh): number {
    // Torus vertex count is roughly (tess+1)^2. This is a heuristic, but good enough here.
    const vertexCount = Math.max(0, mesh.getTotalVertices());
    const estimate = Math.round(Math.sqrt(vertexCount)) - 1;
    return Math.min(128, Math.max(24, estimate || 48));
  }

  private rebuildTorusLikeMeshWithThickerTube(mesh: Mesh, thicknessMultiplier: number): void {
    const scene = mesh.getScene();
    if (!scene) return;

    type OriginalTorusParams = {
      outerDiameter: number;
      thickness: number;
      tessellation: number;
      axisIndex: 0 | 1 | 2;
    };

    // IMPORTANT: make this operation idempotent.
    // Gizmo meshes can be reused across selections/enables; recomputing from already-thickened
    // geometry will "inflate" rings every time.
    const meta = (mesh.metadata ??= {}) as Record<string, unknown>;
    const META_KEY = '__rotationGizmoOriginalTorus';

    let original = meta[META_KEY] as OriginalTorusParams | undefined;
    if (!original) {
      mesh.computeWorldMatrix(true);
      mesh.refreshBoundingInfo(true);
      const ext = mesh.getBoundingInfo().boundingBox.extendSize;

      const axisIndex = this.getSmallestExtentAxisIndex(ext);
      const extValues = [ext.x, ext.y, ext.z].sort((a, b) => a - b);
      const minExtent = extValues[0];
      const outerRadius = extValues[2]; // max extent in the ring plane

      // Interpret extents as torus parameters in local space:
      // - minorRadius ~= minExtent
      // - outerRadius ~= majorRadius + minorRadius
      const outerDiameter = outerRadius * 2;
      const thickness = minExtent * 2;

      original = {
        outerDiameter,
        thickness,
        tessellation: this.estimateTessellation(mesh),
        axisIndex,
      };
      meta[META_KEY] = original;
    }

    const minAxisIdx = original.axisIndex;

    // Keep OUTER diameter stable while thickening the tube.
    // Cap thickness to avoid turning the torus into a solid disk.
    const maxThickness = original.outerDiameter * 0.35;
    const newThickness = Math.min(
      maxThickness,
      Math.max(original.thickness * thicknessMultiplier, original.thickness),
    );
    const newDiameter = Math.max(0.0001, original.outerDiameter - newThickness);

    const tmp = MeshBuilder.CreateTorus(
      `${mesh.name}_thickTmp`,
      { diameter: newDiameter, thickness: newThickness, tessellation: original.tessellation },
      scene,
    );

    // Align tmp torus axis to match the existing mesh's symmetry axis
    tmp.refreshBoundingInfo(true);
    const tmpExt = tmp.getBoundingInfo().boundingBox.extendSize;
    const tmpAxisIdx = this.getSmallestExtentAxisIndex(tmpExt);

    const fromAxis = this.axisVectorFromIndex(tmpAxisIdx);
    const toAxis = this.axisVectorFromIndex(minAxisIdx);
    tmp.rotationQuaternion = this.quaternionFromTo(fromAxis, toAxis);
    tmp.bakeCurrentTransformIntoVertices();

    const vd = VertexData.ExtractFromMesh(tmp);
    vd.applyToMesh(mesh, true);
    mesh.refreshBoundingInfo(true);

    tmp.dispose();
  }

  private applyDepthCueToRotationLoops(): void {
    if (!this.rotationGizmo) return;

    this.removeDepthCueFromRotationLoops();

    Effect.ShadersStore['rotationGizmoDepthCueVertexShader'] = DEPTH_CUE_VERTEX_SHADER;
    Effect.ShadersStore['rotationGizmoDepthCueFragmentShader'] = DEPTH_CUE_FRAGMENT_SHADER;

    const axisGizmos = [
      { gizmo: this.rotationGizmo.xGizmo, baseColor: new Color3(0.9, 0.2, 0.2) },
      { gizmo: this.rotationGizmo.yGizmo, baseColor: new Color3(0.2, 0.9, 0.2) },
      { gizmo: this.rotationGizmo.zGizmo, baseColor: new Color3(0.2, 0.2, 0.9) },
    ];

    const planeGizmo = this.rotationGizmo.xGizmo as { _gizmoMesh?: Mesh };
    const scene = planeGizmo._gizmoMesh?.getScene() as Scene;
    if (!scene) return;

    for (const { gizmo, baseColor } of axisGizmos) {
      const plane = gizmo as { _gizmoMesh?: Mesh };
      const gizmoMesh = plane._gizmoMesh;
      if (!gizmoMesh) continue;

      const children = gizmoMesh.getChildMeshes();
      const rotationMesh = children.find(m => m.visibility > 0) ?? children[0];
      if (!rotationMesh || !(rotationMesh instanceof Mesh)) continue;

      const coloredMaterial = gizmo.coloredMaterial;
      const hoverMaterial = gizmo.hoverMaterial;
      const disableMaterial = gizmo.disableMaterial;

      const depthCueColored = this.createDepthCueMaterial(scene, baseColor, 1, 'depthCueColored');
      const hoverBaseColor = new Color3(
        Math.min(1, baseColor.r * 1.35 + 0.2),
        Math.min(1, baseColor.g * 1.35 + 0.2),
        Math.min(1, baseColor.b * 1.35 + 0.2),
      );
      const depthCueHover = this.createDepthCueMaterial(scene, hoverBaseColor, 1, 'depthCueHover');
      const depthCueDisable = this.createDepthCueMaterial(
        scene,
        new Color3(0.5, 0.5, 0.5),
        0.4,
        'depthCueDisable',
      );

      this.depthCueAxisData.push({
        rotationMesh,
        coloredMaterial,
        hoverMaterial,
        disableMaterial,
        depthCueColored,
        depthCueHover,
        depthCueDisable,
      });
    }

    this.beforeRenderObserver = scene.onBeforeRenderObservable.add(() => {
      const cam = scene.activeCamera;
      const attachedNode = this.gizmoManager.attachedNode;
      const gizmoCenter = attachedNode
        ? (attachedNode as TransformNode).getAbsolutePosition()
        : Vector3.Zero();

      for (const data of this.depthCueAxisData) {
        const current = data.rotationMesh.material;
        if (current === data.coloredMaterial) data.rotationMesh.material = data.depthCueColored;
        else if (current === data.hoverMaterial) data.rotationMesh.material = data.depthCueHover;
        else if (current === data.disableMaterial)
          data.rotationMesh.material = data.depthCueDisable;

        const mat = data.rotationMesh.material;
        if (
          cam &&
          (mat === data.depthCueColored ||
            mat === data.depthCueHover ||
            mat === data.depthCueDisable)
        ) {
          const shaderMat = mat as ShaderMaterial;
          shaderMat.setVector3('cameraPosition', cam.globalPosition);
          shaderMat.setVector3('gizmoCenter', gizmoCenter);
        }
      }
    });
  }

  private createDepthCueMaterial(
    scene: Scene,
    baseColor: Color3,
    alpha: number,
    name: string,
  ): ShaderMaterial {
    const mat = new ShaderMaterial(
      name,
      scene,
      { vertex: 'rotationGizmoDepthCue', fragment: 'rotationGizmoDepthCue' },
      {
        attributes: ['position'],
        uniforms: [
          'world',
          'worldViewProjection',
          'baseColor',
          'cameraPosition',
          'gizmoCenter',
          'alpha',
        ],
      },
    );
    mat.setColor3('baseColor', baseColor);
    mat.setFloat('alpha', alpha);
    mat.backFaceCulling = false;
    // IMPORTANT: enable alpha blending so gl_FragColor.a is respected.
    // Without this, the shader writes alpha but the material is still rendered as opaque.
    mat.transparencyMode = Material.MATERIAL_ALPHABLEND;
    mat.needAlphaBlending = () => true;
    return mat;
  }

  private removeDepthCueFromRotationLoops(): void {
    if (this.beforeRenderObserver) {
      this.beforeRenderObserver.remove();
      this.beforeRenderObserver = null;
    }
    for (const data of this.depthCueAxisData) {
      data.depthCueColored.dispose();
      data.depthCueHover.dispose();
      data.depthCueDisable.dispose();
    }
    this.depthCueAxisData = [];
  }

  enable(): void {
    if (!this.gizmoManager.gizmos.rotationGizmo) return;
    this.rotationGizmo = this.gizmoManager.gizmos.rotationGizmo;
    // Run customization when rotation gizmo is enabled so first use shows new gizmo
    this.customizeGizmoAppearance();
    this.thickenRotationLoops();
    this.applyDepthCueToRotationLoops();
    this.setupDragObservables();
    // Configure gizmo to only work with left click
    configureGizmoButtons(this.gizmoManager.gizmos.rotationGizmo, [LEFT_BUTTON]);
  }

  cleanup(): void {
    this.removeDepthCueFromRotationLoops();
    this.rotationGizmo = null;
    this.cleanupDragObservables();
    this.clearDragState();
    this.currentEntityIds.clear();
  }

  setEntities(entities: EcsEntity[]): void {
    const previousEntityIds = new Set(this.currentEntityIds);
    this.currentEntities = entities;
    this.currentEntityIds = new Set(entities.map(e => e.entityId));

    // Check if entities changed
    const entitiesChanged =
      previousEntityIds.size !== this.currentEntityIds.size ||
      Array.from(this.currentEntityIds).some(id => !previousEntityIds.has(id));

    // Always sync gizmo rotation, especially when world-aligned
    // This fixes the bug where gizmo doesn't reset when switching entities
    this.syncGizmoRotation();

    // If world-aligned and entities changed, ensure gizmo is reset to identity
    if (this.isWorldAligned && entitiesChanged) {
      if (this.gizmoManager.attachedNode) {
        const gizmoNode = this.gizmoManager.attachedNode as TransformNode;
        if (gizmoNode.rotationQuaternion) {
          gizmoNode.rotationQuaternion.set(0, 0, 0, 1);
          gizmoNode.computeWorldMatrix(true);
        }
      }
    }
  }

  setUpdateCallbacks(
    updateEntityRotation: (entity: EcsEntity) => void,
    updateEntityPosition: (entity: EcsEntity) => void,
    dispatchOperations: () => void,
    sceneContext?: any,
  ): void {
    this.updateEntityRotation = updateEntityRotation;
    this.updateEntityPosition = updateEntityPosition;
    this.dispatchOperations = dispatchOperations;
    this.sceneContext = sceneContext;
  }

  setWorldAligned(value: boolean): void {
    this.isWorldAligned = value;

    if (this.gizmoManager.gizmos.rotationGizmo) {
      this.gizmoManager.gizmos.rotationGizmo.updateGizmoRotationToMatchAttachedMesh = !value;
    }

    this.syncGizmoRotation();
  }

  setSnapDistance(_distance: number): void {
    // We handle the snap distance in the snap manager
    return;
  }

  onDragStart(entities: EcsEntity[], gizmoNode: TransformNode): void {
    const selectionChanged = this.hasSelectionChanged(entities);

    if (selectionChanged) {
      this.clearDragState();
      this.initializeDragState(entities, gizmoNode);
      // Update current entity IDs for selection change detection
      this.currentEntityIds = new Set(entities.map(e => e.entityId));
    } else {
      this.updateDragStateRotations(entities);
    }

    // Ensure dragState exists before setting startRotation
    if (!this.dragState) {
      this.initializeDragState(entities, gizmoNode);
    }

    // Store the initial gizmo rotation for delta calculation
    this.dragState!.startRotation = gizmoNode.rotationQuaternion?.clone() || Quaternion.Identity();

    // For world-aligned mode, allow the gizmo to rotate during drag
    // Store the initial rotation and temporarily enable rotation matching
    if (this.isWorldAligned && this.rotationGizmo) {
      this.dragState!.initialGizmoRotation =
        gizmoNode.rotationQuaternion?.clone() || Quaternion.Identity();
      // Temporarily allow the gizmo to rotate with the attached mesh
      // This makes the whole gimbal rotate during drag
      this.rotationGizmo.updateGizmoRotationToMatchAttachedMesh = true;
    }
  }

  update(entities: EcsEntity[], gizmoNode: TransformNode): void {
    if (entities.length === 0) return;

    // Ensure dragState exists
    if (!this.dragState) {
      console.warn('RotationGizmo: No drag state found, initializing...');
      this.initializeDragState(entities, gizmoNode);
    }

    if (entities.length === 1) {
      this.updateSingleEntity(entities[0], gizmoNode);
    } else {
      this.updateMultipleEntities(entities, gizmoNode);
    }
  }

  onDragEnd(): void {
    if (this.currentEntities.length > 1) {
      this.updateMultipleEntitiesRotation();
    }

    // Restore world-aligned behavior: disable rotation matching and reset gizmo
    if (this.isWorldAligned && this.rotationGizmo) {
      // Disable rotation matching first
      this.rotationGizmo.updateGizmoRotationToMatchAttachedMesh = false;
      // Then sync/reset the gizmo rotation back to identity
      this.syncGizmoRotation();
    } else if (!this.isWorldAligned) {
      // For local alignment, let the gizmo maintain its current rotation
      // No sync needed
    }

    this.clearDragState();
  }

  // Private methods for drag observable management
  private setupDragObservables(): void {
    if (!this.gizmoManager.gizmos.rotationGizmo) return;

    const rotationGizmo = this.gizmoManager.gizmos.rotationGizmo;

    this.dragStartObserver = rotationGizmo.onDragStartObservable.add(() => {
      if (this.gizmoManager.attachedNode) {
        this.onDragStart(this.currentEntities, this.gizmoManager.attachedNode as TransformNode);
      }
    });

    this.dragObserver = rotationGizmo.onDragObservable.add(() => {
      if (this.gizmoManager.attachedNode) {
        this.update(this.currentEntities, this.gizmoManager.attachedNode as TransformNode);

        if (this.updateEntityRotation) {
          this.currentEntities.forEach(this.updateEntityRotation);
        }
      }
    });

    this.dragEndObserver = rotationGizmo.onDragEndObservable.add(() => {
      this.onDragEnd();

      if (this.dispatchOperations) {
        this.dispatchOperations();
      }
    });
  }

  private cleanupDragObservables(): void {
    if (!this.gizmoManager.gizmos.rotationGizmo) return;

    const rotationGizmo = this.gizmoManager.gizmos.rotationGizmo;

    if (this.dragStartObserver) {
      rotationGizmo.onDragStartObservable.remove(this.dragStartObserver);
      this.dragStartObserver = null;
    }

    if (this.dragObserver) {
      rotationGizmo.onDragObservable.remove(this.dragObserver);
      this.dragObserver = null;
    }

    if (this.dragEndObserver) {
      rotationGizmo.onDragEndObservable.remove(this.dragEndObserver);
      this.dragEndObserver = null;
    }
  }

  // Private methods for drag state management
  private clearDragState(): void {
    if (this.dragState?.multiTransform) {
      this.dragState.multiTransform.dispose();
    }
    this.dragState = null;
  }

  private initializeDragState(entities: EcsEntity[], _gizmoNode: TransformNode): void {
    const transformData = new Map<Entity, EntityTransformData>();
    this.dragState = {
      startRotation: Quaternion.Identity(),
      entities,
      transformData,
    };

    if (entities.length === 1) {
      this.initializeSingleEntityDragState(entities[0], transformData);
    } else {
      this.initializeMultipleEntitiesDragState(entities, transformData);
    }
  }

  private initializeSingleEntityDragState(
    entity: EcsEntity,
    transformData: Map<Entity, EntityTransformData>,
  ): void {
    const initialRotation = this.isWorldAligned
      ? EntityRotationHelper.getWorldRotation(entity)
      : entity.rotationQuaternion?.clone() || Quaternion.Identity();

    transformData.set(entity.entityId, { initialRotation });
  }

  private initializeMultipleEntitiesDragState(
    entities: EcsEntity[],
    transformData: Map<Entity, EntityTransformData>,
  ): void {
    const centroid = MultiEntityHelper.calculateCentroid(entities);
    const multiTransform = MultiEntityHelper.createMultiTransform(centroid, entities[0].scene);

    for (const entity of entities) {
      const worldPosition = entity.getAbsolutePosition();
      const offset = worldPosition.subtract(centroid);

      const initialRotation = this.isWorldAligned
        ? EntityRotationHelper.getWorldRotation(entity)
        : entity.rotationQuaternion?.clone() || Quaternion.Identity();

      transformData.set(entity.entityId, {
        initialRotation,
        offset,
      });
    }

    this.dragState!.multiTransform = multiTransform;
  }

  private updateDragStateRotations(entities: EcsEntity[]): void {
    if (!this.dragState) return;

    for (const entity of entities) {
      const data = this.dragState.transformData.get(entity.entityId);
      if (data) {
        data.initialRotation = this.isWorldAligned
          ? EntityRotationHelper.getWorldRotation(entity)
          : entity.rotationQuaternion?.clone() || Quaternion.Identity();
      }
    }
  }

  // Private methods for entity updates
  private updateSingleEntity(entity: EcsEntity, gizmoNode: TransformNode): void {
    if (!gizmoNode.rotationQuaternion || !this.dragState) return;

    const data = this.dragState.transformData.get(entity.entityId);
    if (!data) return;

    if (this.isWorldAligned) {
      this.updateSingleEntityWorldAligned(entity, gizmoNode, data);
    } else {
      this.updateSingleEntityLocalAligned(entity, gizmoNode);
    }
  }

  private updateSingleEntityWorldAligned(
    entity: EcsEntity,
    gizmoNode: TransformNode,
    data: EntityTransformData,
  ): void {
    const currentGizmoRotation = gizmoNode.rotationQuaternion;
    if (!currentGizmoRotation) return;

    const hasRotated = !currentGizmoRotation.equals(this.dragState!.startRotation);

    if (hasRotated) {
      const rotationDelta = this.dragState!.startRotation.invert().multiply(currentGizmoRotation);

      // Calculate the accumulated rotation angle since drag start
      const accumulatedAngle = SmoothSnapHelper.getRotationAngle(rotationDelta);
      const snapThreshold = SmoothSnapHelper.getSnapThreshold();

      // Check if we should apply the snap based on the accumulated angle
      const shouldApplySnap = SmoothSnapHelper.shouldApplySnap(
        accumulatedAngle,
        this.dragState!.lastAppliedSnapAngle,
        snapThreshold,
      );

      if (shouldApplySnap) {
        // Apply the snapped rotation
        const snappedRotationDelta = this.snapRotation(rotationDelta);
        const newWorldRotation = snappedRotationDelta.multiply(data.initialRotation);

        EntityRotationHelper.applyRotationToEntity(entity, newWorldRotation, this.isWorldAligned);

        // Update the last applied snap angle to the accumulated angle
        this.dragState!.lastAppliedSnapAngle = accumulatedAngle;
      }
      // If we shouldn't apply snap, the entity keeps its current rotation
      // The gizmo continues to move freely until the next threshold
    } else {
      // Gizmo hasn't rotated, keep the entity's initial rotation
      EntityRotationHelper.applyRotationToEntity(entity, data.initialRotation, this.isWorldAligned);
    }
  }

  private updateSingleEntityLocalAligned(entity: EcsEntity, gizmoNode: TransformNode): void {
    const currentGizmoRotation = gizmoNode.rotationQuaternion;
    if (!currentGizmoRotation) return;

    const data = this.dragState!.transformData.get(entity.entityId);
    if (!data) return;

    const hasRotated = !currentGizmoRotation.equals(this.dragState!.startRotation);

    if (hasRotated) {
      // Calculate the rotation delta from the start of the drag
      const rotationDelta = this.dragState!.startRotation.invert().multiply(currentGizmoRotation);

      // Calculate the accumulated rotation angle since drag start
      const accumulatedAngle = SmoothSnapHelper.getRotationAngle(rotationDelta);
      const snapThreshold = SmoothSnapHelper.getSnapThreshold();

      // Check if we should apply the snap based on the accumulated angle
      const shouldApplySnap = SmoothSnapHelper.shouldApplySnap(
        accumulatedAngle,
        this.dragState!.lastAppliedSnapAngle,
        snapThreshold,
      );

      if (shouldApplySnap) {
        // Apply the snapped rotation
        const snappedGizmoRotation = this.snapRotation(currentGizmoRotation);

        // For local alignment, the gizmo rotation represents the target world rotation
        // Convert it to local rotation for the entity
        if (entity.parent && entity.parent instanceof TransformNode) {
          const parent = entity.parent as TransformNode;
          const parentWorldRotation =
            parent.rotationQuaternion || Quaternion.FromRotationMatrix(parent.getWorldMatrix());
          const localRotation = parentWorldRotation.invert().multiply(snappedGizmoRotation);

          if (!entity.rotationQuaternion) {
            entity.rotationQuaternion = new Quaternion();
          }
          entity.rotationQuaternion.copyFrom(localRotation);
        } else {
          // No parent, world rotation is local rotation
          if (!entity.rotationQuaternion) {
            entity.rotationQuaternion = new Quaternion();
          }
          entity.rotationQuaternion.copyFrom(snappedGizmoRotation);
        }

        // Update the last applied snap angle to the accumulated angle
        this.dragState!.lastAppliedSnapAngle = accumulatedAngle;
      }
      // If we shouldn't apply snap, the entity keeps its current rotation
      // The gizmo continues to move freely until the next threshold
    } else {
      // Gizmo hasn't rotated, keep the entity's initial rotation
      if (!entity.rotationQuaternion) {
        entity.rotationQuaternion = new Quaternion();
      }
      entity.rotationQuaternion.copyFrom(data.initialRotation);
    }

    // Force update world matrix
    entity.computeWorldMatrix(true);
  }

  private updateMultipleEntities(entities: EcsEntity[], gizmoNode: TransformNode): void {
    if (!gizmoNode.rotationQuaternion || !this.dragState) return;

    // Ensure we have the multiTransform and initial data
    if (!this.dragState.multiTransform || this.dragState.transformData.size === 0) {
      // If we don't have the data, recreate them
      this.clearDragState();
      this.initializeDragState(entities, gizmoNode);
    }

    const currentGizmoRotation = gizmoNode.rotationQuaternion;
    const hasRotated = !currentGizmoRotation.equals(this.dragState.startRotation);

    if (hasRotated) {
      const rotationDelta = this.dragState.startRotation.invert().multiply(currentGizmoRotation);

      // Calculate the accumulated rotation angle since drag start
      const accumulatedAngle = SmoothSnapHelper.getRotationAngle(rotationDelta);
      const snapThreshold = SmoothSnapHelper.getSnapThreshold();

      // Check if we should apply the snap based on the accumulated angle
      const shouldApplySnap = SmoothSnapHelper.shouldApplySnap(
        accumulatedAngle,
        this.dragState.lastAppliedSnapAngle,
        snapThreshold,
      );

      if (shouldApplySnap) {
        // Apply the snapped rotation
        const snappedRotationDelta = this.snapRotation(rotationDelta);

        this.applyRotationToMultipleEntities(entities, snappedRotationDelta);

        // Update the last applied snap angle to the accumulated angle
        this.dragState.lastAppliedSnapAngle = accumulatedAngle;
      }
      // If we shouldn't apply snap, the entities keep their current rotation
      // The gizmo continues to move freely until the next threshold
    } else {
      this.resetMultipleEntitiesToInitialState(entities);
    }
  }

  private applyRotationToMultipleEntities(entities: EcsEntity[], rotationDelta: Quaternion): void {
    if (!this.dragState?.multiTransform) return;

    for (const entity of entities) {
      const data = this.dragState.transformData.get(entity.entityId);
      if (!data || !data.offset) continue;

      const newWorldPosition = MultiEntityHelper.calculateRotatedPosition(
        data.offset,
        rotationDelta,
        this.dragState.multiTransform!.position,
      );

      const newWorldRotation = rotationDelta.multiply(data.initialRotation);

      this.applyTransformToEntity(entity, newWorldPosition, newWorldRotation);
    }
  }

  private resetMultipleEntitiesToInitialState(entities: EcsEntity[]): void {
    for (const entity of entities) {
      const data = this.dragState!.transformData.get(entity.entityId);
      if (!data) continue;

      EntityRotationHelper.applyRotationToEntity(entity, data.initialRotation, this.isWorldAligned);
    }
  }

  private applyTransformToEntity(
    entity: EcsEntity,
    worldPosition: Vector3,
    worldRotation: Quaternion,
  ): void {
    if (entity.parent && entity.parent instanceof TransformNode) {
      const parent = entity.parent as TransformNode;
      const parentWorldMatrixInverse = parent.getWorldMatrix().clone().invert();

      const localPosition = Vector3.TransformCoordinates(worldPosition, parentWorldMatrixInverse);
      const localRotation = EntityRotationHelper.getLocalRotation(worldRotation, parent);

      entity.position.copyFrom(localPosition);
      if (!entity.rotationQuaternion) {
        entity.rotationQuaternion = new Quaternion();
      }
      entity.rotationQuaternion.copyFrom(localRotation);
    } else {
      entity.position.copyFrom(worldPosition);
      if (!entity.rotationQuaternion) {
        entity.rotationQuaternion = new Quaternion();
      }
      entity.rotationQuaternion.copyFrom(worldRotation);
    }

    // Force update world matrix
    entity.computeWorldMatrix(true);
  }

  // Private utility methods
  private hasSelectionChanged(entities: EcsEntity[]): boolean {
    const newEntityIds = new Set(entities.map(e => e.entityId));

    if (this.currentEntityIds.size !== newEntityIds.size) return true;

    for (const id of newEntityIds) {
      if (!this.currentEntityIds.has(id)) return true;
    }

    return false;
  }

  private syncGizmoRotation(): void {
    if (!this.gizmoManager.attachedNode) return;

    const gizmoNode = this.gizmoManager.attachedNode as TransformNode;

    // Always ensure world-aligned gizmo is reset to identity, regardless of previous state
    if (this.isWorldAligned) {
      if (gizmoNode.rotationQuaternion) {
        gizmoNode.rotationQuaternion.set(0, 0, 0, 1);
      }
      gizmoNode.computeWorldMatrix(true);
    } else {
      // For local alignment, use the helper
      GizmoSyncHelper.syncGizmoRotation(gizmoNode, this.currentEntities, this.isWorldAligned);
    }
  }

  private updateMultipleEntitiesRotation(): void {
    if (!this.sceneContext || this.currentEntities.length <= 1) return;

    this.currentEntities.forEach(entity => {
      if (this.updateEntityRotation) {
        this.updateEntityRotation(entity);
      }
      if (this.updateEntityPosition) {
        this.updateEntityPosition(entity);
      }
    });

    if (this.dispatchOperations) {
      this.dispatchOperations();
    }
  }
}
