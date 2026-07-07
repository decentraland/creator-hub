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
import ReactEcs, { ReactEcsRenderer, UiEntity } from '@dcl/sdk/react-ecs';
import { Vector3, Quaternion, Color4, Color3 } from '@dcl/sdk/math';

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
const handleOf: Partial<Record<Axis, Entity>> = {};
let selected: Entity | null = null;
// The selected entity's world position, supplied by the inspector (the agent
// can't read the inspected scene's Transform). The gizmo's anchor.
let selectedPos: Vector3 | null = null;
// Scene-local → engine-world offset (base parcel × 16m). The inspector renders
// every scene at the ORIGIN (SceneContext.rootNode at 0,0,0), so the positions
// it sends are scene-LOCAL; the engine loads the scene at its real parcel, so we
// must add this offset to place the gizmo where the scene actually is.
let sceneOffset: Vector3 = Vector3.Zero();
let picker: Entity | null = null;
let rayTs = 0;

interface DragState {
  axis: Axis;
  center: Vector3; // entity world position at drag start
  planeNormal: Vector3;
  startHit: Vector3;
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

/** Attach the gizmo to an entity at a scene-local position (or hide when null).
 * The scene offset is added so it lands in the engine's world space. */
export function setSelectedEntity(
  entity: number | null,
  position: { x: number; y: number; z: number } | null,
): void {
  selected = entity !== null && entity !== 0 ? (entity as Entity) : null;
  selectedPos =
    selected !== null && position
      ? Vector3.add(Vector3.create(position.x, position.y, position.z), sceneOffset)
      : null;
  if (selected === null || selectedPos === null) hideGizmo();
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
      const grabbedAxis = selected === null ? null : pickAxisAnalytic(ray);
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
  const camT = Transform.getOrNull(engine.CameraEntity);
  const camForward =
    camT === null ? Vector3.Forward() : Vector3.rotate(Vector3.Forward(), camT.rotation);
  const planeNormal = axisDragPlaneNormal(axisVec(axis), camForward);
  const startHit = rayPlaneIntersect(ray.origin, ray.dir, center, planeNormal);
  if (startHit === null) return;
  drag = { axis, center, planeNormal, startHit };
  dragPos = center;
}

function updateDrag(): void {
  if (drag === null || selected === null) return;
  const ray = pointerRay();
  if (ray === null) return;
  const hit = rayPlaneIntersect(ray.origin, ray.dir, drag.center, drag.planeNormal);
  if (hit === null) return;
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
  if (d === null || selected === null || finalPos === null) return;
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
