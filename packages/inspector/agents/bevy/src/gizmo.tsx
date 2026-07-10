import {
  engine,
  Transform,
  MeshRenderer,
  MeshCollider,
  Material,
  ColliderLayer,
  CameraLayer,
  CameraLayers,
  TextureCamera,
  UiCanvasInformation,
  Raycast,
  RaycastResult,
  RaycastQueryType,
  PrimaryPointerInfo,
  InputAction,
  PointerEventType,
  inputSystem,
} from '@dcl/sdk/ecs';
import type { Entity } from '@dcl/sdk/ecs';
// ReactEcs is the JSX pragma (used as a value by the JSX transform for the
// gizmoOverlay UI), so it must be a runtime default import — the
// consistent-type-imports rule mis-flags it because it sees no explicit usage.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import ReactEcs, { ReactEcsRenderer, UiEntity } from '@dcl/sdk/react-ecs';
import { Vector3, Quaternion, Color4, Color3 } from '@dcl/sdk/math';
import type { GizmoMode } from '@dcl/inspector-bevy-protocol';

import { bus } from './bus';

/**
 * Minimal translate gizmo (prototype). Three axis handles attached to the
 * selected entity; dragging a handle moves the entity along that axis. During
 * the drag the move is previewed live in the inspected scene via a console
 * `set_component` write; on release the committed position is posted to the
 * inspector (`gizmoCommit` + `gizmoCommitEnd`), which owns the authoritative ECS
 * write — matching the IRenderer reverse-channel contract (renderer previews,
 * inspector commits).
 *
 * The selected entity's world position is SUPPLIED BY THE INSPECTOR over the bus
 * (set-selection), because a super-user agent can't read another scene's
 * Transform from its own engine. Scope: translate only, no rotate/scale, no
 * TextureCamera composite (handles render in the world, not on-top).
 */

type Axis = 'x' | 'y' | 'z';
const AXES: Axis[] = ['x', 'y', 'z'];

// Gizmo geometry (world units at scale 1; the root is scaled by camera distance).
const SHAFT_LEN = 1.2;
const SHAFT_R = 0.03;
const HANDLE_R = 0.12;
const SCALE_FACTOR = 0.12; // fraction of camera distance
const MIN_SCALE = 0.2;
const MAX_SCALE = 50;

const AXIS_ROTATION: Record<Axis, Quaternion> = {
  x: Quaternion.fromEulerDegrees(0, 0, -90), // +Y arrow → +X
  y: Quaternion.fromEulerDegrees(0, 0, 0),
  z: Quaternion.fromEulerDegrees(90, 0, 0), // +Y arrow → +Z
};
const AXIS_COLOR: Record<Axis, Color4> = {
  x: Color4.create(0.9, 0.2, 0.2, 1),
  y: Color4.create(0.2, 0.9, 0.2, 1),
  z: Color4.create(0.3, 0.4, 1, 1),
};
const axisVec = (a: Axis): Vector3 =>
  a === 'x' ? Vector3.Right() : a === 'y' ? Vector3.Up() : Vector3.Forward();

let gizmoRoot: Entity | null = null;
// Translate arm containers + rotate ring containers, per axis. Shown/hidden by
// mode (setModeVisibility): translate shows the arms, rotate shows the rings.
const handleOf: Partial<Record<Axis, Entity>> = {};
const translateGroupOf: Partial<Record<Axis, Entity>> = {};
const rotateGroupOf: Partial<Record<Axis, Entity>> = {};
const scaleGroupOf: Partial<Record<Axis, Entity>> = {};

// Rotation ring geometry: a ring of short cylinder segments (no torus mesh in
// the SDK) in the plane perpendicular to its axis, radius RING_R at scale 1.
const RING_R = 1.0;
const RING_SEGMENTS = 24;
const RING_SEG_R = 0.03;

// Scale handle geometry: a short axis shaft capped with a cube (vs translate's
// arrow), grabbed like the translate arm; drag distance → per-axis multiplier.
const SCALE_BOX = 0.18;
let selected: Entity | null = null;
// The selected entity's world position, supplied by the inspector (the agent
// can't read the inspected scene's Transform). The gizmo's anchor.
let selectedPos: Vector3 | null = null;
// Which gizmo the inspector wants shown (translate/rotate/scale/free). Only
// `translate` draws handles today; rotate/scale are later slices.
let gizmoMode: GizmoMode = 'translate';
// Scene-local → engine-world offset (base parcel × 16m). The inspector renders
// every scene at the ORIGIN (SceneContext.rootNode at 0,0,0), so the positions
// it sends are scene-LOCAL; the engine loads the scene at its real parcel, so we
// must add this offset to place the gizmo where the scene actually is.
let sceneOffset: Vector3 = Vector3.Zero();
let picker: Entity | null = null;
let rayTs = 0;

interface DragState {
  mode: 'translate' | 'rotate' | 'scale';
  axis: Axis;
  center: Vector3; // entity world position at drag start
  planeNormal: Vector3;
  startHit: Vector3;
  // Rotate only: the signed angle (radians) swept so far, about `axis`.
  angle?: number;
  // Scale only: the along-axis offset of the start hit from center, and the
  // current scale factor for the axis (committed on release).
  startAlong?: number;
  factor?: number;
}
let drag: DragState | null = null;
// A pointer-down sets this; the next raycast result decides drag-vs-pick.
let grabPending = false;
let pendingModifiers = { shift: false, ctrl: false };
// The entity's live position during a drag (committed on release).
let dragPos: Vector3 | null = null;

// One raycast serves both gizmo grab (handles on CL_POINTER=1) and entity pick
// (scene colliders on CL_POINTER|CL_PHYSICS). 1 | 2 covers both.
const PICK_OR_HANDLE_MASK = 1 | 2;

// The gizmo renders on its own camera layer, drawn by a dedicated TextureCamera
// that mirrors the main camera and is composited ON TOP of the viewport (via a
// full-screen videoTexture UI). The main camera never renders GIZMO_LAYER, so
// the gizmo is always visible regardless of world geometry (never occluded).
const GIZMO_LAYER = 4;
let gizmoCamera: Entity | null = null;

// The engine's actual vertical FOV (radians). The gizmo composite MUST use the
// same FOV as the main camera, or the rendered arrows land at a different screen
// position than the analytic grab ray expects (clicks miss by several units).
// `getCameraFov` is a runtime op the engine ships but doesn't type — declare it.
let engineFovY = Math.PI / 4;
async function refreshEngineFov(): Promise<void> {
  try {
    const runtime = (
      globalThis as {
        require?: (m: string) => { getCameraFov?: () => Promise<number> };
      }
    ).require?.('~system/Runtime');
    const fov = await runtime?.getCameraFov?.();
    if (fov !== undefined && Number.isFinite(fov) && fov > 0) engineFovY = fov;
  } catch {
    /* keep the current value */
  }
}

export function isGizmoDragging(): boolean {
  return drag !== null || grabPending;
}

/** Set the scene-local → engine-world offset from the inspected scene's base
 * parcel (x,y in parcels): world = local + (base.x*16, 0, base.y*16). */
export function setSceneOffset(baseParcelX: number, baseParcelY: number): void {
  sceneOffset = Vector3.create(baseParcelX * 16, 0, baseParcelY * 16);
}

/**
 * The scene-local ground point under the engine's current pointer — for placing
 * a drag-dropped asset (the inspector's `getPointerWorldPoint` for Bevy). Casts
 * the current pointer ray onto the scene ground plane (engine-world y=0) and
 * converts back to scene-local (subtracting the scene offset), matching the
 * coordinate space the inspector operates in. Null if the pointer/ray isn't
 * available or the ray doesn't meet the ground (e.g. aimed at the sky).
 */
export function getGroundPointAtPointer(): { x: number; y: number; z: number } | null {
  const ray = pointerRay();
  if (ray === null) return null;
  // Ground plane at engine-world y=0 (the scene's base plane), normal up.
  const hit = rayPlaneIntersect(ray.origin, ray.dir, sceneOffset, Vector3.Up());
  if (hit === null) return null;
  const local = Vector3.subtract(hit, sceneOffset);
  return { x: local.x, y: 0, z: local.z };
}

/** Attach the gizmo to an entity at a scene-local position (or hide when null).
 * The scene offset is added so it lands in the engine's world space. */
export function setSelectedEntity(
  entity: number | null,
  position: { x: number; y: number; z: number } | null,
  mode: GizmoMode = 'translate',
): void {
  selected = entity !== null && entity !== 0 ? (entity as Entity) : null;
  selectedPos =
    selected !== null && position
      ? Vector3.add(Vector3.create(position.x, position.y, position.z), sceneOffset)
      : null;
  gizmoMode = mode;
  // Show handles for translate / rotate / scale; `free` shows none.
  const supported = mode === 'translate' || mode === 'rotate' || mode === 'scale';
  if (selected === null || selectedPos === null || !supported) {
    hideGizmo();
  } else {
    setModeVisibility();
  }
}

export function setupGizmo(): void {
  picker = engine.addEntity();
  Transform.create(picker);
  buildGizmo();
  setupGizmoCamera();
  hideGizmo();
  engine.addSystem(gizmoSystem);
  // Composite the gizmo camera's render ON TOP of the viewport.
  ReactEcsRenderer.setUiRenderer(gizmoOverlay);
  // Keep the gizmo camera's FOV matched to the engine's (for grab accuracy).
  void refreshEngineFov();
  let fovTick = 0;
  engine.addSystem(() => {
    if (fovTick++ % 120 === 0) void refreshEngineFov(); // ~every couple seconds
  });
}

// A TextureCamera renders only GIZMO_LAYER to a transparent texture (mirrored to
// the main camera each frame); gizmoOverlay draws it full-screen over the
// viewport, so the gizmo is always on top.
function setupGizmoCamera(): void {
  if (gizmoCamera !== null) return;
  const canvas = UiCanvasInformation.getOrNull(engine.RootEntity);
  const cam = engine.addEntity();
  Transform.create(cam);
  TextureCamera.create(cam, {
    width: canvas?.width ?? 1280,
    height: canvas?.height ?? 720,
    layer: GIZMO_LAYER,
    clearColor: Color4.create(0, 0, 0, 0), // transparent → only the gizmo shows
    mode: { $case: 'perspective', perspective: { fieldOfView: engineFovY } },
  });
  CameraLayer.create(cam, {
    layer: GIZMO_LAYER,
    directionalLight: false,
    showAvatars: false,
    showSkybox: false,
    showFog: false,
  });
  gizmoCamera = cam;
}

function gizmoOverlay(): ReactEcs.JSX.Element | null {
  // Only show the composite while a gizmo is up (an entity is selected).
  if (gizmoCamera === null || selected === null || selectedPos === null) return null;
  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        height: '100%',
        positionType: 'absolute',
        position: { top: 0, left: 0 },
        pointerFilter: 'none',
      }}
      uiBackground={{ textureMode: 'stretch', videoTexture: { videoPlayerEntity: gizmoCamera } }}
    />
  );
}

function buildGizmo(): void {
  const root = engine.addEntity();
  Transform.create(root);
  // Render the handle tree only on GIZMO_LAYER (main camera skips it; the gizmo
  // TextureCamera draws it, composited on top).
  CameraLayers.create(root, { layers: [GIZMO_LAYER] });
  gizmoRoot = root;
  for (const axis of AXES) {
    const container = engine.addEntity();
    Transform.create(container, { rotation: AXIS_ROTATION[axis], parent: root });
    translateGroupOf[axis] = container;

    const shaft = engine.addEntity();
    Transform.create(shaft, {
      position: Vector3.create(0, SHAFT_LEN / 2, 0),
      scale: Vector3.create(1, SHAFT_LEN, 1),
      parent: container,
    });
    MeshRenderer.setCylinder(shaft, SHAFT_R, SHAFT_R);
    Material.setPbrMaterial(shaft, {
      albedoColor: AXIS_COLOR[axis],
      emissiveColor: Color3.create(AXIS_COLOR[axis].r, AXIS_COLOR[axis].g, AXIS_COLOR[axis].b),
      emissiveIntensity: 0.4,
    });

    // A fat collider along the axis so the handle is easy to grab.
    const handle = engine.addEntity();
    Transform.create(handle, {
      position: Vector3.create(0, SHAFT_LEN / 2, 0),
      scale: Vector3.create(1, SHAFT_LEN, 1),
      parent: container,
    });
    MeshCollider.setCylinder(handle, HANDLE_R, HANDLE_R, ColliderLayer.CL_POINTER);
    handleOf[axis] = handle;

    buildRotateRing(root, axis);
    buildScaleHandle(root, axis);
  }
}

/**
 * A scale handle for `axis`: a short shaft capped with a cube, along the axis.
 * Grab is analytic (shared `pickAxisAnalytic`, same axis segment as translate),
 * so no collider. Parented to a per-axis group toggled by mode.
 */
function buildScaleHandle(root: Entity, axis: Axis): void {
  const group = engine.addEntity();
  Transform.create(group, { rotation: AXIS_ROTATION[axis], parent: root });
  scaleGroupOf[axis] = group;

  const shaft = engine.addEntity();
  Transform.create(shaft, {
    position: Vector3.create(0, SHAFT_LEN / 2, 0),
    scale: Vector3.create(1, SHAFT_LEN, 1),
    parent: group,
  });
  MeshRenderer.setCylinder(shaft, SHAFT_R, SHAFT_R);
  Material.setPbrMaterial(shaft, {
    albedoColor: AXIS_COLOR[axis],
    emissiveColor: Color3.create(AXIS_COLOR[axis].r, AXIS_COLOR[axis].g, AXIS_COLOR[axis].b),
    emissiveIntensity: 0.4,
  });

  const cap = engine.addEntity();
  Transform.create(cap, {
    position: Vector3.create(0, SHAFT_LEN, 0),
    scale: Vector3.create(SCALE_BOX, SCALE_BOX, SCALE_BOX),
    parent: group,
  });
  MeshRenderer.setBox(cap);
  Material.setPbrMaterial(cap, {
    albedoColor: AXIS_COLOR[axis],
    emissiveColor: Color3.create(AXIS_COLOR[axis].r, AXIS_COLOR[axis].g, AXIS_COLOR[axis].b),
    emissiveIntensity: 0.4,
  });
}

/**
 * A rotation ring for `axis`: RING_SEGMENTS short cylinders laid end-to-end
 * around a circle in the plane perpendicular to the axis (the SDK has no torus).
 * Grab is analytic (ray-vs-circle in `pickRotateAxisAnalytic`), so these are
 * visual only — no colliders. Parented to a per-axis group toggled by mode.
 */
function buildRotateRing(root: Entity, axis: Axis): void {
  const group = engine.addEntity();
  Transform.create(group, { parent: root });
  rotateGroupOf[axis] = group;

  // The ring lies in the plane whose normal is the axis. Build it in local XZ
  // (normal = +Y) then rotate the group so +Y maps to the axis.
  const toAxis: Record<Axis, Quaternion> = {
    x: Quaternion.fromEulerDegrees(0, 0, 90), // +Y → +X
    y: Quaternion.Identity(),
    z: Quaternion.fromEulerDegrees(90, 0, 0), // +Y → +Z
  };
  Transform.getMutable(group).rotation = toAxis[axis];

  for (let i = 0; i < RING_SEGMENTS; i++) {
    const a0 = (i / RING_SEGMENTS) * Math.PI * 2;
    const a1 = ((i + 1) / RING_SEGMENTS) * Math.PI * 2;
    const p0 = Vector3.create(Math.cos(a0) * RING_R, 0, Math.sin(a0) * RING_R);
    const p1 = Vector3.create(Math.cos(a1) * RING_R, 0, Math.sin(a1) * RING_R);
    const mid = Vector3.scale(Vector3.add(p0, p1), 0.5);
    const seg = Vector3.subtract(p1, p0);
    const segLen = Vector3.length(seg);
    const chordDir = Vector3.normalize(seg);
    const cyl = engine.addEntity();
    // A cylinder is +Y-long; rotate its +Y axis onto the chord direction.
    Transform.create(cyl, {
      position: mid,
      rotation: Quaternion.fromToRotation(Vector3.Up(), chordDir),
      scale: Vector3.create(1, segLen, 1),
      parent: group,
    });
    MeshRenderer.setCylinder(cyl, RING_SEG_R, RING_SEG_R);
    Material.setPbrMaterial(cyl, {
      albedoColor: AXIS_COLOR[axis],
      emissiveColor: Color3.create(AXIS_COLOR[axis].r, AXIS_COLOR[axis].g, AXIS_COLOR[axis].b),
      emissiveIntensity: 0.4,
    });
  }
}

/** Show the handle group for the active mode, hide the others. */
function setModeVisibility(): void {
  const shown = Vector3.One();
  const hidden = Vector3.Zero();
  for (const axis of AXES) {
    const groups: [GizmoMode, Entity | undefined][] = [
      ['translate', translateGroupOf[axis]],
      ['rotate', rotateGroupOf[axis]],
      ['scale', scaleGroupOf[axis]],
    ];
    for (const [mode, group] of groups) {
      if (group !== undefined)
        Transform.getMutable(group).scale = gizmoMode === mode ? shown : hidden;
    }
  }
}

function hideGizmo(): void {
  if (gizmoRoot === null) return;
  // Park it far below and tiny so it's neither visible nor hittable.
  Transform.getMutable(gizmoRoot).position = Vector3.create(0, -100000, 0);
  Transform.getMutable(gizmoRoot).scale = Vector3.create(0, 0, 0);
}

function cameraDistanceScale(pos: Vector3): number {
  const camT = Transform.getOrNull(engine.CameraEntity);
  if (camT === null) return MIN_SCALE;
  const d = Vector3.distance(camT.position, pos);
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, d * SCALE_FACTOR));
}

function pointerRay(): { origin: Vector3; dir: Vector3 } | null {
  const p = PrimaryPointerInfo.getOrNull(engine.RootEntity);
  const camT = Transform.getOrNull(engine.CameraEntity);
  const dir = p?.worldRayDirection;
  if (dir === undefined || camT === null) return null;
  return { origin: camT.position, dir: dir as Vector3 };
}

/** Intersect a ray with a plane through `p0` with normal `n`. */
function rayPlaneIntersect(origin: Vector3, dir: Vector3, p0: Vector3, n: Vector3): Vector3 | null {
  const denom = Vector3.dot(dir, n);
  if (Math.abs(denom) < 1e-6) return null;
  const t = Vector3.dot(Vector3.subtract(p0, origin), n) / denom;
  if (t < 0) return null;
  return Vector3.add(origin, Vector3.scale(dir, t));
}

/** Drag plane containing the axis and most facing the camera. */
function axisDragPlaneNormal(axisDir: Vector3, camForward: Vector3): Vector3 {
  const c = Vector3.cross(axisDir, camForward);
  const n = Vector3.cross(c, axisDir);
  const len = Vector3.length(n);
  return len < 1e-6 ? Vector3.Up() : Vector3.scale(n, 1 / len);
}

/** Closest distance between a ray (origin, unit dir, t≥0) and a finite segment
 * [a,b]. Standard closest-point-between-two-segments (Ericson, RTCD §5.1.9) with
 * the ray treated as a long segment. Used to grab an axis arm analytically —
 * the engine raycast is unreliable for these tiny, screen-scaled handles. */
function raySegmentDistance(
  origin: Vector3,
  dir: Vector3,
  a: Vector3,
  b: Vector3,
): { dist: number; t: number } {
  const RAY_LEN = 100000;
  const d1 = Vector3.scale(dir, RAY_LEN); // ray as a long segment from origin
  const d2 = Vector3.subtract(b, a); // the axis segment
  const r = Vector3.subtract(origin, a);
  const A = Vector3.dot(d1, d1); // squared length of ray segment
  const e = Vector3.dot(d2, d2); // squared length of axis segment
  const f = Vector3.dot(d2, r);
  const c = Vector3.dot(d1, r);
  const bb = Vector3.dot(d1, d2);
  const denom = A * e - bb * bb;
  let s = 0;
  if (denom > 1e-9) s = Math.min(Math.max((bb * f - c * e) / denom, 0), 1); // ray param [0,1]
  let tSeg = (bb * s + f) / (e < 1e-9 ? 1 : e); // axis param
  if (tSeg < 0) {
    tSeg = 0;
    s = Math.min(Math.max(-c / (A < 1e-9 ? 1 : A), 0), 1);
  } else if (tSeg > 1) {
    tSeg = 1;
    s = Math.min(Math.max((bb - c) / (A < 1e-9 ? 1 : A), 0), 1);
  }
  const rayPt = Vector3.add(origin, Vector3.scale(d1, s));
  const segPt = Vector3.add(a, Vector3.scale(d2, tSeg));
  return { dist: Vector3.distance(rayPt, segPt), t: s * RAY_LEN };
}

/** Analytic grab: which axis arm the pointer ray is closest to (within a
 * screen-scaled tolerance), or null. Anchored at the gizmo center (selectedPos),
 * arms extend `SHAFT_LEN * scale` along each world axis. */
function pickAxisAnalytic(ray: { origin: Vector3; dir: Vector3 }): Axis | null {
  if (selectedPos === null) return null;
  const scale = cameraDistanceScale(selectedPos);
  const armLen = SHAFT_LEN * scale;
  // Grab radius as a fraction of arm length (not the thin handle radius) — a
  // forgiving, constant-on-screen target since the click is hand-aimed.
  const tol = armLen * 0.4;
  let best: Axis | null = null;
  let bestDist = Infinity;
  for (const axis of AXES) {
    const end = Vector3.add(selectedPos, Vector3.scale(axisVec(axis), armLen));
    const { dist } = raySegmentDistance(ray.origin, ray.dir, selectedPos, end);
    if (dist <= tol && dist < bestDist) {
      bestDist = dist;
      best = axis;
    }
  }
  return best;
}

/** Analytic rotate grab: which ring the pointer ray meets (hit on the axis plane
 * within a tolerance band around the ring radius), or null. The ring for `axis`
 * lies in the plane through the center with normal = axis. */
function pickRotateAxisAnalytic(ray: { origin: Vector3; dir: Vector3 }): Axis | null {
  if (selectedPos === null) return null;
  const scale = cameraDistanceScale(selectedPos);
  const ringR = RING_R * scale;
  const tol = ringR * 0.25; // forgiving band around the ring
  let best: Axis | null = null;
  let bestErr = Infinity;
  for (const axis of AXES) {
    const n = axisVec(axis);
    const hit = rayPlaneIntersect(ray.origin, ray.dir, selectedPos, n);
    if (hit === null) continue;
    const r = Vector3.distance(hit, selectedPos);
    const err = Math.abs(r - ringR);
    if (err <= tol && err < bestErr) {
      bestErr = err;
      best = axis;
    }
  }
  return best;
}

/** The angle (radians) of `hit` around `center` in the plane ⊥ `axis`, measured
 * in a stable basis so successive frames compare consistently. */
function angleOnRing(hit: Vector3, center: Vector3, axis: Axis): number {
  const n = axisVec(axis);
  // Two orthonormal in-plane basis vectors (u, v) with u×v = n.
  const ref = axis === 'y' ? Vector3.Forward() : Vector3.Up();
  const u = Vector3.normalize(Vector3.cross(ref, n));
  const v = Vector3.cross(n, u);
  const d = Vector3.subtract(hit, center);
  return Math.atan2(Vector3.dot(d, v), Vector3.dot(d, u));
}

// NOTE: no live set_component preview during the drag. The agent can't read the
// inspected entity's real Transform (cross-engine), so a preview write would have
// to guess rotation/scale/parent — and writing identity/unit values CLOBBERS the
// entity's real rotation + scale. Instead we move only the gizmo visual during
// the drag and emit the committed position on release; the inspector's
// reverse-channel MERGES it into the real Transform (preserving rotation/scale/
// parent) and it flows back over the CRDT. Trade-off: the model jumps to the new
// spot on release rather than tracking continuously — acceptable for the MVP.

function gizmoSystem(): void {
  try {
    gizmoSystemInner();
  } catch (e) {
    // A throw here would otherwise halt the engine's system loop (killing pick +
    // selection too). Log and keep running.
    console.error('[bevy-agent gizmo] system error:', e);
  }
}

function gizmoSystemInner(): void {
  if (gizmoRoot === null) return;

  // Keep the gizmo camera glued to the main camera (pose + FOV) so the composite
  // projects EXACTLY where the world does — otherwise the rendered arrows land
  // off from where the analytic grab ray expects and clicks miss.
  if (gizmoCamera !== null) {
    const camT = Transform.getOrNull(engine.CameraEntity);
    if (camT !== null) {
      const g = Transform.getMutable(gizmoCamera);
      g.position = { ...camT.position };
      g.rotation = { ...camT.rotation };
    }
    const tc = TextureCamera.getMutableOrNull(gizmoCamera);
    if (tc !== null && tc.mode?.$case === 'perspective') {
      tc.mode.perspective.fieldOfView = engineFovY;
    }
  }

  // Position + scale the gizmo on the selected entity each frame (the inspector
  // supplied selectedPos; during a drag we update it locally below).
  if (selected !== null && selectedPos !== null && drag === null) {
    const t = Transform.getMutable(gizmoRoot);
    t.position = { ...selectedPos };
    t.rotation = Quaternion.Identity();
    const s = cameraDistanceScale(selectedPos);
    t.scale = Vector3.create(s, s, s);
  }

  const down = inputSystem.isTriggered(InputAction.IA_POINTER, PointerEventType.PET_DOWN);
  const up =
    inputSystem.isTriggered(InputAction.IA_POINTER, PointerEventType.PET_UP) ||
    !inputSystem.isPressed(InputAction.IA_POINTER);

  // On pointer-down: FIRST try to grab a gizmo axis analytically (ray-vs-axis-
  // segment) — the engine's collider raycast is unreliable for these tiny,
  // screen-scaled handles (it lands offset, camera-dependently). If no axis is
  // grabbed, fall through to an engine raycast for entity picking.
  if (drag === null && !grabPending && down) {
    const ray = pointerRay();
    if (ray !== null && picker !== null) {
      const grabbedAxis =
        selected === null
          ? null
          : gizmoMode === 'rotate'
            ? pickRotateAxisAnalytic(ray)
            : pickAxisAnalytic(ray);
      if (grabbedAxis !== null) {
        beginDrag(grabbedAxis);
      } else {
        // Not a gizmo grab → raycast the scene for a pick (resolved next frame).
        Transform.createOrReplace(picker, { position: { ...ray.origin } });
        rayTs += 1;
        Raycast.createOrReplace(picker, {
          timestamp: rayTs,
          maxDistance: 1000,
          queryType: RaycastQueryType.RQT_QUERY_ALL,
          continuous: false,
          collisionMask: PICK_OR_HANDLE_MASK,
          direction: { $case: 'globalDirection', globalDirection: { ...ray.dir } },
        });
        grabPending = true;
        pendingModifiers = readModifiers();
      }
    }
  }

  // Resolve a pick raycast (only set when the analytic grab missed).
  if (grabPending && picker !== null) {
    const result = RaycastResult.getOrNull(picker);
    if (result !== null && result.timestamp === rayTs) {
      grabPending = false;
      emitPick(result, pendingModifiers);
    }
  }

  // Drive / finish an active drag.
  if (drag !== null) {
    if (up) endDrag();
    else updateDrag();
  }
}

function readModifiers(): { shift: boolean; ctrl: boolean } {
  // Modifiers aren't exposed per-frame in this minimal setup; single-select only.
  return { shift: false, ctrl: false };
}

/** Emit a pick from a raycast result (nearest authored hit, id ≥ 512). */
function emitPick(
  result: { hits: readonly { readonly entityId?: number; readonly length?: number }[] },
  mods: { shift: boolean; ctrl: boolean },
): void {
  const ordered = [...result.hits]
    .filter(h => h.entityId !== undefined)
    .sort((a, b) => (a.length ?? 0) - (b.length ?? 0));
  for (const h of ordered) {
    const id = Number(h.entityId);
    if (id < 512) continue; // skip probe/gizmo/reserved
    // Skip our own gizmo handles (they're CL_POINTER hits but not scene entities).
    if (isGizmoHandle(id)) continue;
    bus.postToPage({ kind: 'pick', entity: id, shift: mods.shift, ctrl: mods.ctrl });
    return;
  }
  bus.postToPage({ kind: 'pick', entity: 0, shift: mods.shift, ctrl: mods.ctrl });
}

function isGizmoHandle(id: number): boolean {
  for (const axis of AXES) {
    if ((handleOf[axis] as number | undefined) === id) return true;
  }
  return false;
}

function beginDrag(axis: Axis): void {
  if (selected === null || selectedPos === null) return;
  const center = { ...selectedPos };
  const ray = pointerRay();
  if (ray === null) return;

  if (gizmoMode === 'rotate') {
    // Rotate: drag in the ring's plane (normal = the axis). Record the start
    // angle around the ring; the drag tracks the swept angle.
    const planeNormal = axisVec(axis);
    const startHit = rayPlaneIntersect(ray.origin, ray.dir, center, planeNormal);
    if (startHit === null) return;
    drag = { mode: 'rotate', axis, center, planeNormal, startHit, angle: 0 };
    return;
  }

  // Translate + scale: drag in a plane containing the axis and most facing the
  // camera, projecting the pointer onto the axis. They differ only in what the
  // along-axis motion means (position offset vs scale factor).
  const camT = Transform.getOrNull(engine.CameraEntity);
  const camForward =
    camT === null ? Vector3.Forward() : Vector3.rotate(Vector3.Forward(), camT.rotation);
  const planeNormal = axisDragPlaneNormal(axisVec(axis), camForward);
  const startHit = rayPlaneIntersect(ray.origin, ray.dir, center, planeNormal);
  if (startHit === null) return;

  if (gizmoMode === 'scale') {
    // Distance from center to the grab point along the axis = the "current arm
    // length"; the factor is (current distance / start distance), so dragging
    // outward grows and inward shrinks. Clamp start away from 0 to avoid blow-up.
    const startAlong = Vector3.dot(Vector3.subtract(startHit, center), axisVec(axis));
    drag = {
      mode: 'scale',
      axis,
      center,
      planeNormal,
      startHit,
      startAlong: Math.abs(startAlong) < 1e-3 ? 1e-3 : startAlong,
      factor: 1,
    };
    return;
  }

  drag = { mode: 'translate', axis, center, planeNormal, startHit };
  dragPos = center;
}

function updateDrag(): void {
  if (drag === null || selected === null) return;
  const ray = pointerRay();
  if (ray === null) return;
  const hit = rayPlaneIntersect(ray.origin, ray.dir, drag.center, drag.planeNormal);
  if (hit === null) return;

  if (drag.mode === 'rotate') {
    // Swept angle since drag start, unwrapped across the ±π seam so a drag past
    // half a turn keeps accumulating instead of flipping sign.
    const startAngle = angleOnRing(drag.startHit, drag.center, drag.axis);
    const nowAngle = angleOnRing(hit, drag.center, drag.axis);
    let delta = nowAngle - startAngle;
    const prev = drag.angle ?? 0;
    while (delta - prev > Math.PI) delta -= Math.PI * 2;
    while (delta - prev < -Math.PI) delta += Math.PI * 2;
    drag.angle = delta;
    // Spin the whole gizmo visual about the axis for feedback.
    if (gizmoRoot !== null) {
      Transform.getMutable(gizmoRoot).rotation = Quaternion.fromAngleAxis(
        (delta * 180) / Math.PI,
        axisVec(drag.axis),
      );
    }
    return;
  }

  if (drag.mode === 'scale') {
    // Factor = current along-axis distance / start distance. Dragging the handle
    // outward grows, inward shrinks; clamp to keep the factor positive + sane.
    const nowAlong = Vector3.dot(Vector3.subtract(hit, drag.center), axisVec(drag.axis));
    const raw = nowAlong / (drag.startAlong ?? 1);
    const factor = Math.min(Math.max(raw, 0.01), 100);
    drag.factor = factor;
    // Feedback: stretch the gizmo along the axis (the container is axis-oriented
    // with +Y along the axis, so scale Y). Only the active axis' handle stretches.
    const group = scaleGroupOf[drag.axis];
    if (group !== undefined) Transform.getMutable(group).scale = Vector3.create(1, factor, 1);
    return;
  }

  const worldDelta = Vector3.subtract(hit, drag.startHit);
  const dir = axisVec(drag.axis);
  const along = Vector3.dot(worldDelta, dir);
  const newPos = Vector3.add(drag.center, Vector3.scale(dir, along));
  dragPos = newPos;

  // Move only the gizmo visual during the drag (feedback); the entity itself is
  // moved by the inspector on commit (see the note above previewMove's removal).
  if (gizmoRoot !== null) Transform.getMutable(gizmoRoot).position = newPos;
}

function endDrag(): void {
  const d = drag;
  const finalPos = dragPos;
  drag = null;
  dragPos = null;
  if (d === null || selected === null) return;

  if (d.mode === 'rotate') {
    const angle = d.angle ?? 0;
    // Reset the gizmo visual (the entity's real rotation updates via the commit,
    // flows back over the CRDT, and the inspector re-anchors the gizmo).
    if (gizmoRoot !== null) Transform.getMutable(gizmoRoot).rotation = Quaternion.Identity();
    if (Math.abs(angle) < 1e-4) return; // no-op drag → nothing to commit
    // Commit a DELTA rotation about the axis; the inspector composes it onto the
    // entity's current rotation (the agent can't read that base). Rotation is
    // orientation-only, so — unlike position — no scene-offset conversion.
    const delta = Quaternion.fromAngleAxis((angle * 180) / Math.PI, axisVec(d.axis));
    bus.postToPage({
      kind: 'gizmoCommit',
      transforms: [
        {
          entity: selected as number,
          rotation: { x: delta.x, y: delta.y, z: delta.z, w: delta.w },
        },
      ],
    });
    bus.postToPage({ kind: 'gizmoCommitEnd' });
    return;
  }

  if (d.mode === 'scale') {
    const factor = d.factor ?? 1;
    // Reset the stretched handle visual (the entity's real scale updates via the
    // commit → CRDT, and the inspector re-anchors the gizmo).
    const group = scaleGroupOf[d.axis];
    if (group !== undefined) Transform.getMutable(group).scale = Vector3.One();
    if (Math.abs(factor - 1) < 1e-3) return; // no-op drag
    // Commit a per-axis scale MULTIPLIER (1 on the untouched axes); the inspector
    // multiplies it onto the entity's current scale. Scale is dimensionless, so
    // no scene-offset conversion.
    const mul = {
      x: d.axis === 'x' ? factor : 1,
      y: d.axis === 'y' ? factor : 1,
      z: d.axis === 'z' ? factor : 1,
    };
    bus.postToPage({
      kind: 'gizmoCommit',
      transforms: [{ entity: selected as number, scale: mul }],
    });
    bus.postToPage({ kind: 'gizmoCommitEnd' });
    return;
  }

  if (finalPos === null) return;
  // Adopt the committed position as the gizmo's new anchor (engine-world).
  selectedPos = finalPos;
  // Convert back to SCENE-LOCAL before committing: the inspector's Transform is
  // scene-local (it renders every scene at the origin), so subtract the offset
  // we added when placing. Without this, a world position would be written into
  // a local Transform and the entity would jump by the parcel offset.
  const localPos = Vector3.subtract(finalPos, sceneOffset);
  bus.postToPage({
    kind: 'gizmoCommit',
    transforms: [{ entity: selected as number, position: { ...localPos } }],
  });
  bus.postToPage({ kind: 'gizmoCommitEnd' });
}
