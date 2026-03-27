import type { Color3 } from '@babylonjs/core';
import {
  Vector3,
  TransformNode,
  Color4,
  UtilityLayerRenderer,
  PointerDragBehavior,
  MeshBuilder,
  StandardMaterial,
  type Mesh,
  type LinesMesh,
  type Scene,
  type Observer,
} from '@babylonjs/core';
import type { Entity } from '@dcl/ecs';
import type { EcsEntity } from '../EcsEntity';
import type { IGizmoTransformer } from './types';
import { GizmoType } from './types';
import {
  AXIS_RED,
  AXIS_GREEN,
  AXIS_BLUE,
  YELLOW_HOVER_COLOR,
  GREY_INACTIVE_COLOR,
} from './constants';

// ─── Layout ─────────────────────────────────────────────────────────────────
//  6 face handles  — one per face, colored by axis (X=red, Y=green, Z=blue)
//    Drag toward +axis / away from −axis: scales that axis only, opposite face anchored.
//  8 corner handles — white spheres at every corner
//    Drag away from / toward center: uniform scale, opposite corner anchored.
// ─────────────────────────────────────────────────────────────────────────────

const FACE_HANDLE_SIZE = 0.11;
const FACE_HANDLE_OFFSET = FACE_HANDLE_SIZE * 0.65; // protrudes outside the face panel
const CORNER_HANDLE_SIZE = 0.09;
const CENTER_HANDLE_SIZE = 0.11;
const MIN_HALF_SIZE = 0.005;

interface FaceConfig {
  axis: 'x' | 'y' | 'z';
  sign: 1 | -1;
  color: Color3;
}

const FACE_CONFIGS: FaceConfig[] = [
  { axis: 'x', sign: 1, color: AXIS_RED },
  { axis: 'x', sign: -1, color: AXIS_RED },
  { axis: 'y', sign: 1, color: AXIS_GREEN },
  { axis: 'y', sign: -1, color: AXIS_GREEN },
  { axis: 'z', sign: 1, color: AXIS_BLUE },
  { axis: 'z', sign: -1, color: AXIS_BLUE },
];

const CORNER_SIGNS: Vector3[] = [
  new Vector3(1, 1, 1),
  new Vector3(1, 1, -1),
  new Vector3(1, -1, 1),
  new Vector3(1, -1, -1),
  new Vector3(-1, 1, 1),
  new Vector3(-1, 1, -1),
  new Vector3(-1, -1, 1),
  new Vector3(-1, -1, -1),
];

interface DragState {
  initialEntityWorldPos: Map<Entity, Vector3>;
  initialEntityScale: Map<Entity, Vector3>;
  initialBoundsCenter: Vector3;
  initialBoundsHalfSize: Vector3;
  totalDrag: number;
}

export class BoundingBoxScaleGizmo implements IGizmoTransformer {
  type = GizmoType.SCALE;

  private utilityLayer: UtilityLayerRenderer | null = null;
  private faceHandles: Mesh[] = [];
  private cornerHandles: Mesh[] = [];
  private centerHandle: Mesh | null = null;
  private wireframe: LinesMesh | null = null;
  private facePanels: Mesh[] = [];
  private mainScene: Scene | null = null;
  private beforeRenderObserver: Observer<Scene> | null = null;

  private currentEntities: EcsEntity[] = [];
  private isDragging = false;
  private dragState: DragState | null = null;

  private updateEntityScale: ((entity: EcsEntity) => void) | null = null;
  private dispatchOperations: (() => void) | null = null;
  private dispatchDuringDrag: (() => void) | null = null;

  constructor(
    private snapScale: (scale: Vector3) => Vector3,
    private getUniformScaleOnly?: () => boolean,
  ) {}

  setup(): void {}

  enable(): void {
    const entity = this.currentEntities[0];
    if (!entity) return;
    this.mainScene = entity.getScene();
    this.utilityLayer = new UtilityLayerRenderer(this.mainScene);
    // Always draw scale handles in front of scene geometry (same as the position/rotation gizmos)
    this.utilityLayer.utilityLayerScene.autoClearDepthAndStencil = true;
    this.buildHandles(entity);
    this.startTrackingBounds(entity);
  }

  cleanup(): void {
    if (this.mainScene && this.beforeRenderObserver) {
      this.mainScene.onBeforeRenderObservable.remove(this.beforeRenderObserver);
      this.beforeRenderObserver = null;
    }
    for (const h of this.faceHandles) h.dispose();
    for (const h of this.cornerHandles) h.dispose();
    for (const p of this.facePanels) p.dispose();
    this.centerHandle?.dispose();
    this.wireframe?.dispose();
    this.faceHandles = [];
    this.cornerHandles = [];
    this.facePanels = [];
    this.centerHandle = null;
    this.wireframe = null;
    this.utilityLayer?.dispose();
    this.utilityLayer = null;
    this.mainScene = null;
    this.dragState = null;
  }

  setEntities(entities: EcsEntity[]): void {
    this.currentEntities = entities;
  }

  setUpdateCallbacks(
    updateEntityScale: (entity: EcsEntity) => void,
    dispatchOperations: () => void,
  ): void {
    this.updateEntityScale = updateEntityScale;
    this.dispatchOperations = dispatchOperations;
  }

  setDispatchDuringDragCallback(fn: () => void): void {
    this.dispatchDuringDrag = fn;
  }

  setWorldAligned(_value: boolean): void {}
  setSnapDistance(_distance: number): void {}
  onDragStart(_entities: EcsEntity[], _node: TransformNode): void {}
  update(_entities: EcsEntity[], _node: TransformNode): void {}
  onDragEnd(): void {}

  // ─── Bounds ────────────────────────────────────────────────────────────────

  private getWorldBounds(entity: EcsEntity): { center: Vector3; halfSize: Vector3 } {
    entity.computeWorldMatrix(true);
    const { min, max } = entity.getHierarchyBoundingVectors(true);
    return {
      center: min.add(max).scaleInPlace(0.5),
      halfSize: max.subtract(min).scaleInPlace(0.5),
    };
  }

  // ─── Handle creation ───────────────────────────────────────────────────────

  private buildHandles(entity: EcsEntity): void {
    const utilScene = this.utilityLayer!.utilityLayerScene;
    const { center, halfSize } = this.getWorldBounds(entity);

    // Face handles
    for (const cfg of FACE_CONFIGS) {
      const handle = MeshBuilder.CreateBox(
        `bb_face_${cfg.axis}${cfg.sign > 0 ? '+' : '-'}`,
        { size: FACE_HANDLE_SIZE },
        utilScene,
      );
      const mat = new StandardMaterial(`${handle.name}_mat`, utilScene);
      mat.emissiveColor = cfg.color.clone();
      mat.disableLighting = true;
      handle.material = mat;
      handle.position.copyFrom(this.facePos(center, halfSize, cfg));
      this.addFaceDrag(handle, cfg, entity, mat);
      this.faceHandles.push(handle);
    }

    // Corner handles
    for (let i = 0; i < CORNER_SIGNS.length; i++) {
      const signs = CORNER_SIGNS[i];
      const handle = MeshBuilder.CreateSphere(
        `bb_corner_${i}`,
        { diameter: CORNER_HANDLE_SIZE, segments: 5 },
        utilScene,
      );
      const mat = new StandardMaterial(`${handle.name}_mat`, utilScene);
      mat.emissiveColor = GREY_INACTIVE_COLOR.clone();
      mat.disableLighting = true;
      handle.material = mat;
      handle.position.copyFrom(this.cornerPos(center, halfSize, signs));
      this.addCornerDrag(handle, signs, entity, mat);
      this.cornerHandles.push(handle);
    }

    // Center handle (uniform XYZ scale)
    this.centerHandle = this.buildCenterHandle(center, entity, utilScene);

    // Wireframe box
    this.wireframe = this.buildWireframe(center, halfSize, utilScene);

    // Semi-transparent face panels
    this.facePanels = this.buildFacePanels(center, halfSize, utilScene);
  }

  private buildCenterHandle(center: Vector3, entity: EcsEntity, utilScene: Scene): Mesh {
    const handle = MeshBuilder.CreateBox('bb_center', { size: CENTER_HANDLE_SIZE }, utilScene);
    const mat = new StandardMaterial('bb_center_mat', utilScene);
    mat.emissiveColor = GREY_INACTIVE_COLOR.clone();
    mat.disableLighting = true;
    handle.material = mat;
    handle.position.copyFrom(center);
    this.addCenterDrag(handle, entity, mat, GREY_INACTIVE_COLOR);
    return handle;
  }

  private addCenterDrag(
    handle: Mesh,
    entity: EcsEntity,
    mat: StandardMaterial,
    baseColor: Color3,
  ): void {
    // Drag along world diagonal — distance from center maps to uniform scale factor
    const dragAxis = new Vector3(1, 1, 1).normalize();
    const drag = new PointerDragBehavior({ dragAxis });
    drag.moveAttached = false;

    drag.onDragStartObservable.add(() => {
      this.isDragging = true;
      const { center } = this.getWorldBounds(entity);
      this.dragState = {
        initialEntityWorldPos: new Map([[entity.entityId, entity.getAbsolutePosition().clone()]]),
        initialEntityScale: new Map([[entity.entityId, entity.scaling.clone()]]),
        initialBoundsCenter: center,
        initialBoundsHalfSize: this.getWorldBounds(entity).halfSize,
        totalDrag: 0,
      };
    });

    drag.onDragObservable.add(evt => {
      const state = this.dragState;
      if (!state) return;

      state.totalDrag += Vector3.Dot(evt.delta, dragAxis);

      const initScale = state.initialEntityScale.get(entity.entityId)!;
      const initSize = state.initialBoundsHalfSize.length();
      const scaleFactor = Math.max(0.01, (initSize + state.totalDrag) / initSize);
      const newScale = this.snapScale(initScale.clone().scaleInPlace(scaleFactor));
      entity.scaling.copyFrom(newScale);
      entity.computeWorldMatrix(true);

      // Reposition so the bounds center stays at initialBoundsCenter
      const { center: newCenter } = this.getWorldBounds(entity);
      const worldDelta = state.initialBoundsCenter.subtract(newCenter);
      this.applyPositionDeltaVec(entity, worldDelta, state);
      entity.computeWorldMatrix(true);

      this.updateEntityScale?.(entity);
      this.dispatchDuringDrag?.();
      this.refreshHandlePositions();
    });

    drag.onDragEndObservable.add(() => {
      this.isDragging = false;
      this.dragState = null;
      this.dispatchOperations?.();
    });

    this.addHover(handle, mat, baseColor);
    handle.addBehavior(drag);
  }

  private buildWireframe(center: Vector3, halfSize: Vector3, utilScene: Scene): LinesMesh {
    const { x: hx, y: hy, z: hz } = halfSize;
    const c = center;
    // 8 corners
    const corners = [
      new Vector3(c.x - hx, c.y - hy, c.z - hz),
      new Vector3(c.x + hx, c.y - hy, c.z - hz),
      new Vector3(c.x + hx, c.y + hy, c.z - hz),
      new Vector3(c.x - hx, c.y + hy, c.z - hz),
      new Vector3(c.x - hx, c.y - hy, c.z + hz),
      new Vector3(c.x + hx, c.y - hy, c.z + hz),
      new Vector3(c.x + hx, c.y + hy, c.z + hz),
      new Vector3(c.x - hx, c.y + hy, c.z + hz),
    ];
    const lines = [
      // bottom face
      [corners[0], corners[1]],
      [corners[1], corners[2]],
      [corners[2], corners[3]],
      [corners[3], corners[0]],
      // top face
      [corners[4], corners[5]],
      [corners[5], corners[6]],
      [corners[6], corners[7]],
      [corners[7], corners[4]],
      // verticals
      [corners[0], corners[4]],
      [corners[1], corners[5]],
      [corners[2], corners[6]],
      [corners[3], corners[7]],
    ];
    const wireColor = new Color4(1, 1, 1, 0.6);
    const colors = lines.map(() => [wireColor, wireColor]);
    return MeshBuilder.CreateLineSystem(
      'bb_wireframe',
      { lines, colors, updatable: true },
      utilScene,
    );
  }

  private buildFacePanels(center: Vector3, halfSize: Vector3, utilScene: Scene): Mesh[] {
    const panels: Mesh[] = [];
    const PANEL_ALPHA = 0.08;

    for (const cfg of FACE_CONFIGS) {
      // Unit box — scaled via panel.scaling each frame
      const panel = MeshBuilder.CreateBox(
        `bb_panel_${cfg.axis}${cfg.sign > 0 ? '+' : '-'}`,
        { size: 1 },
        utilScene,
      );

      // Orient so the thin dimension faces the axis
      if (cfg.axis === 'x') {
        panel.rotation.y = Math.PI / 2;
      } else if (cfg.axis === 'y') {
        panel.rotation.x = Math.PI / 2;
      }
      // z-axis: no rotation needed

      const mat = new StandardMaterial(
        `bb_panel_${cfg.axis}${cfg.sign > 0 ? '+' : '-'}_mat`,
        utilScene,
      );
      mat.diffuseColor = cfg.color.clone();
      mat.emissiveColor = cfg.color.scale(0.3);
      mat.alpha = PANEL_ALPHA;
      mat.backFaceCulling = false;
      mat.disableLighting = true;
      panel.material = mat;
      panel.isPickable = false;

      panels.push(panel);
    }

    // Position + scale to match initial bounds
    this.updateFacePanelTransforms(center, halfSize, panels);
    return panels;
  }

  private updateFacePanelTransforms(
    center: Vector3,
    halfSize: Vector3,
    panels = this.facePanels,
  ): void {
    const { x: hx, y: hy, z: hz } = halfSize;
    for (let i = 0; i < FACE_CONFIGS.length; i++) {
      const panel = panels[i];
      if (!panel) continue;
      const cfg = FACE_CONFIGS[i];
      const pos = center.clone();
      pos[cfg.axis] += cfg.sign * halfSize[cfg.axis];
      panel.position.copyFrom(pos);
      // scale: (face width, face height, thin depth=0.001)
      if (cfg.axis === 'x') panel.scaling.set(2 * hz, 2 * hy, 0.001);
      else if (cfg.axis === 'y') panel.scaling.set(2 * hx, 2 * hz, 0.001);
      else panel.scaling.set(2 * hx, 2 * hy, 0.001);
    }
  }

  private facePos(center: Vector3, halfSize: Vector3, cfg: FaceConfig): Vector3 {
    const pos = center.clone();
    pos[cfg.axis] += cfg.sign * (halfSize[cfg.axis] + FACE_HANDLE_OFFSET);
    return pos;
  }

  private cornerPos(center: Vector3, halfSize: Vector3, signs: Vector3): Vector3 {
    return new Vector3(
      center.x + signs.x * halfSize.x,
      center.y + signs.y * halfSize.y,
      center.z + signs.z * halfSize.z,
    );
  }

  // ─── Face drag ─────────────────────────────────────────────────────────────

  private addFaceDrag(
    handle: Mesh,
    cfg: FaceConfig,
    entity: EcsEntity,
    mat: StandardMaterial,
  ): void {
    const axisVec = Vector3.Zero();
    axisVec[cfg.axis] = 1;
    const drag = new PointerDragBehavior({ dragAxis: axisVec });
    drag.moveAttached = false;

    drag.onDragStartObservable.add(() => {
      this.isDragging = true;
      const { center, halfSize } = this.getWorldBounds(entity);
      this.dragState = {
        initialEntityWorldPos: new Map([[entity.entityId, entity.getAbsolutePosition().clone()]]),
        initialEntityScale: new Map([[entity.entityId, entity.scaling.clone()]]),
        initialBoundsCenter: center,
        initialBoundsHalfSize: halfSize,
        totalDrag: 0,
      };
    });

    drag.onDragObservable.add(evt => {
      const state = this.dragState;
      if (!state) return;

      state.totalDrag += cfg.sign * evt.delta[cfg.axis];

      const { initialBoundsCenter: bc, initialBoundsHalfSize: bh } = state;
      const anchorFace = bc[cfg.axis] - cfg.sign * bh[cfg.axis];
      const newFace = bc[cfg.axis] + cfg.sign * bh[cfg.axis] + cfg.sign * state.totalDrag;
      const newHalf = Math.max(MIN_HALF_SIZE, Math.abs(newFace - anchorFace) / 2);
      const scaleFactor = newHalf / bh[cfg.axis];

      const initScale = state.initialEntityScale.get(entity.entityId)!;
      const newScale = initScale.clone();
      newScale[cfg.axis] = Math.max(0.01, initScale[cfg.axis] * scaleFactor);
      entity.scaling.copyFrom(this.snapScale(newScale));
      entity.computeWorldMatrix(true);

      // Reposition so the anchor face stays fixed
      const newCenter = anchorFace + cfg.sign * newHalf;
      const worldDeltaAxis = newCenter - bc[cfg.axis];
      this.applyPositionDelta(entity, cfg.axis, worldDeltaAxis, state);
      entity.computeWorldMatrix(true);

      this.updateEntityScale?.(entity);
      this.dispatchDuringDrag?.();
      this.refreshHandlePositions();
    });

    drag.onDragEndObservable.add(() => {
      this.isDragging = false;
      this.dragState = null;
      this.dispatchOperations?.();
    });

    // Hover tint
    handle.actionManager = null;
    this.addHover(handle, mat, cfg.color);

    handle.addBehavior(drag);
  }

  // ─── Corner drag ───────────────────────────────────────────────────────────

  private addCornerDrag(
    handle: Mesh,
    signs: Vector3,
    entity: EcsEntity,
    mat: StandardMaterial,
  ): void {
    // Drag along the corner's diagonal direction (center → corner)
    let dragAxis = signs.clone().normalize();
    const drag = new PointerDragBehavior({ dragAxis });
    drag.moveAttached = false;

    drag.onDragStartObservable.add(() => {
      this.isDragging = true;
      const { center, halfSize } = this.getWorldBounds(entity);
      // Recompute drag axis from current bounds so it matches actual corner direction
      const cornerOffset = new Vector3(
        signs.x * halfSize.x,
        signs.y * halfSize.y,
        signs.z * halfSize.z,
      );
      dragAxis = cornerOffset.normalizeToNew();
      drag.options.dragAxis = dragAxis;

      this.dragState = {
        initialEntityWorldPos: new Map([[entity.entityId, entity.getAbsolutePosition().clone()]]),
        initialEntityScale: new Map([[entity.entityId, entity.scaling.clone()]]),
        initialBoundsCenter: center,
        initialBoundsHalfSize: halfSize,
        totalDrag: 0,
      };
    });

    drag.onDragObservable.add(evt => {
      const state = this.dragState;
      if (!state) return;

      state.totalDrag += Vector3.Dot(evt.delta, dragAxis);

      const { initialBoundsHalfSize: bh, initialBoundsCenter: bc } = state;
      const initDiag = new Vector3(signs.x * bh.x, signs.y * bh.y, signs.z * bh.z).length();
      const newDiag = Math.max(0.01, initDiag + state.totalDrag);
      const scaleFactor = newDiag / initDiag;

      const initScale = state.initialEntityScale.get(entity.entityId)!;
      const newScale = this.snapScale(initScale.clone().scaleInPlace(scaleFactor));
      entity.scaling.copyFrom(newScale);
      entity.computeWorldMatrix(true);

      // Keep opposite corner fixed
      const { halfSize: newHalf } = this.getWorldBounds(entity);
      const anchor = new Vector3(
        bc.x - signs.x * bh.x,
        bc.y - signs.y * bh.y,
        bc.z - signs.z * bh.z,
      );
      const newCenter = new Vector3(
        anchor.x + signs.x * newHalf.x,
        anchor.y + signs.y * newHalf.y,
        anchor.z + signs.z * newHalf.z,
      );
      const worldDelta = newCenter.subtract(bc);
      this.applyPositionDeltaVec(entity, worldDelta, state);
      entity.computeWorldMatrix(true);

      this.updateEntityScale?.(entity);
      this.dispatchDuringDrag?.();
      this.refreshHandlePositions();
    });

    drag.onDragEndObservable.add(() => {
      this.isDragging = false;
      this.dragState = null;
      this.dispatchOperations?.();
    });

    this.addHover(handle, mat, GREY_INACTIVE_COLOR);
    handle.addBehavior(drag);
  }

  // ─── Position helpers ──────────────────────────────────────────────────────

  private applyPositionDelta(
    entity: EcsEntity,
    axis: 'x' | 'y' | 'z',
    worldDelta: number,
    state: DragState,
  ): void {
    const v = Vector3.Zero();
    v[axis] = worldDelta;
    this.applyPositionDeltaVec(entity, v, state);
  }

  private applyPositionDeltaVec(entity: EcsEntity, worldDelta: Vector3, state: DragState): void {
    const initWorldPos = state.initialEntityWorldPos.get(entity.entityId)!;
    const newWorldPos = initWorldPos.add(worldDelta);
    const parent = entity.parent instanceof TransformNode ? entity.parent : null;

    if (!parent) {
      entity.position.copyFrom(newWorldPos);
    } else {
      const invParent = parent.getWorldMatrix().clone().invert();
      entity.position.copyFrom(Vector3.TransformCoordinates(newWorldPos, invParent));
    }
  }

  // ─── Handle position refresh ───────────────────────────────────────────────

  private refreshHandlePositions(): void {
    const entity = this.currentEntities[0];
    if (!entity) return;
    const { center, halfSize } = this.getWorldBounds(entity);

    for (let i = 0; i < FACE_CONFIGS.length; i++) {
      this.faceHandles[i]?.position.copyFrom(this.facePos(center, halfSize, FACE_CONFIGS[i]));
    }
    for (let i = 0; i < CORNER_SIGNS.length; i++) {
      this.cornerHandles[i]?.position.copyFrom(this.cornerPos(center, halfSize, CORNER_SIGNS[i]));
    }

    // Update wireframe
    if (this.wireframe) {
      const { x: hx, y: hy, z: hz } = halfSize;
      const c = center;
      const corners = [
        new Vector3(c.x - hx, c.y - hy, c.z - hz),
        new Vector3(c.x + hx, c.y - hy, c.z - hz),
        new Vector3(c.x + hx, c.y + hy, c.z - hz),
        new Vector3(c.x - hx, c.y + hy, c.z - hz),
        new Vector3(c.x - hx, c.y - hy, c.z + hz),
        new Vector3(c.x + hx, c.y - hy, c.z + hz),
        new Vector3(c.x + hx, c.y + hy, c.z + hz),
        new Vector3(c.x - hx, c.y + hy, c.z + hz),
      ];
      const lines = [
        [corners[0], corners[1]],
        [corners[1], corners[2]],
        [corners[2], corners[3]],
        [corners[3], corners[0]],
        [corners[4], corners[5]],
        [corners[5], corners[6]],
        [corners[6], corners[7]],
        [corners[7], corners[4]],
        [corners[0], corners[4]],
        [corners[1], corners[5]],
        [corners[2], corners[6]],
        [corners[3], corners[7]],
      ];
      const wireColor = new Color4(1, 1, 1, 0.6);
      const colors = lines.map(() => [wireColor, wireColor]);
      MeshBuilder.CreateLineSystem('bb_wireframe', { lines, colors, instance: this.wireframe });
    }

    // Update center handle
    if (this.centerHandle) this.centerHandle.position.copyFrom(center);

    // Update face panels
    this.updateFacePanelTransforms(center, halfSize);
  }

  private startTrackingBounds(_entity: EcsEntity): void {
    this.beforeRenderObserver = this.mainScene!.onBeforeRenderObservable.add(() => {
      if (!this.isDragging) this.refreshHandlePositions();
    });
  }

  // ─── Hover tint ────────────────────────────────────────────────────────────

  private addHover(handle: Mesh, mat: StandardMaterial, baseColor: Color3): void {
    const utilScene = this.utilityLayer!.utilityLayerScene;
    utilScene.onPointerObservable.add(info => {
      if (!info.pickInfo) return;
      const hit = info.pickInfo.pickedMesh === handle;
      mat.emissiveColor = hit ? YELLOW_HOVER_COLOR : baseColor.clone();
    });
  }
}
