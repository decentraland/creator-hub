import {
  engine,
  Transform,
  VirtualCamera,
  MainCamera,
  InputModifier,
  PointerLock,
  PrimaryPointerInfo,
  InputAction,
  inputSystem,
} from '@dcl/sdk/ecs';
import type { Entity } from '@dcl/sdk/ecs';
import { Quaternion, Vector3 } from '@dcl/sdk/math';
import type { CameraMode } from '@dcl/inspector-bevy-protocol';

import { bus } from './bus';

/**
 * Editor fly-camera for the Bevy renderer (slice 1: free-fly only).
 *
 * The engine's native camera is the player AVATAR (walk/jump/third-person look) —
 * fine for previewing, wrong for editing (you don't want an avatar walking around
 * while you build). So, like bevy-editor, `free` mode takes over the camera with a
 * VirtualCamera the agent drives itself: WASD flies, mouse-look aims (while the
 * pointer is locked), and the avatar's input is disabled so those keys belong to
 * the camera. `avatar` mode releases the takeover back to the native camera.
 *
 * Ported/adapted from bevy-editor `packages/scene/src/camera/free-cam.ts` (same
 * engine build + SDK), trimmed to the fly path; focus + orbit are later slices.
 */

const MOUSE_SENSITIVITY = 0.003;
const FLY_SPEED = 15; // m/s (bevy-editor's default fly feel)
const PITCH_LIMIT = Math.PI / 2 - 0.01;
const RAD_TO_DEG = 180 / Math.PI;
const MIN_FRAME_DIST = 0.5;
const MAX_FRAME_DIST = 12; // keep a framed entity comfortably in view
const TWEEN_DURATION = 0.3; // seconds

let camEntity: Entity | null = null;
let mode: CameraMode = 'avatar';
let yaw = 0;
let pitch = 0;
// Whether the avatar's WASD walk input is currently enabled (engine default:
// enabled). Toggled to match the camera mode by reconcileAvatarInput.
let avatarWalkEnabled = true;
// Vertical fly held state from the host (E = up, Q = down). Q has no SDK
// InputAction, so the engine can't read it; the inspector captures E/Q and
// forwards the held state over the bus (see setVerticalInput). Added to the
// per-frame fly move alongside the engine-read IA_JUMP (Space) = up.
let verticalUp = false;
let verticalDown = false;
// Scene-local → engine-world offset (base parcel × 16m). The inspector sends
// world positions in SCENE-LOCAL coords (it renders every scene at the origin),
// but the engine loads the scene at its real parcel — so we add this offset to
// frame the entity where it actually is (mirrors the gizmo's setSceneOffset).
let sceneOffset: Vector3 = Vector3.Zero();

/** Set the scene-local → engine-world offset from the inspected scene's base parcel. */
export function setCameraSceneOffset(baseParcelX: number, baseParcelY: number): void {
  sceneOffset = Vector3.create(baseParcelX * 16, 0, baseParcelY * 16);
}

/** Set the vertical fly-camera held state forwarded by the host (E = up, Q = down). */
export function setVerticalInput(up: boolean, down: boolean): void {
  verticalUp = up;
  verticalDown = down;
}

// An eased move to a framing pose (focus-on-entity); cancelled by any manual input.
let tween: {
  fromPos: Vector3;
  toPos: Vector3;
  fromYaw: number;
  toYaw: number;
  fromPitch: number;
  toPitch: number;
  elapsed: number;
} | null = null;

function clampPitch(p: number): number {
  return Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, p));
}

/** Look rotation for the current yaw/pitch. */
function lookRotation(): Quaternion {
  const yawQ = Quaternion.fromAngleAxis(yaw * RAD_TO_DEG, Vector3.Up());
  const pitchQ = Quaternion.fromAngleAxis(pitch * RAD_TO_DEG, Vector3.Right());
  return Quaternion.multiply(yawQ, pitchQ);
}

/** Seed yaw/pitch from a look direction (so entering free-cam keeps the aim). */
function aimAlong(dir: Vector3): void {
  const horiz = Math.sqrt(dir.x * dir.x + dir.z * dir.z);
  yaw = Math.atan2(dir.x, dir.z);
  pitch = clampPitch(Math.atan2(-dir.y, horiz));
}

/** Begin an eased move to `toPos` aiming along `lookDir`, from the current pose. */
function startTween(toPos: Vector3, lookDir: Vector3): void {
  if (camEntity === null) return;
  const horiz = Math.sqrt(lookDir.x * lookDir.x + lookDir.z * lookDir.z);
  const rawYaw = Math.atan2(lookDir.x, lookDir.z);
  // Take the shortest angular path to the target yaw (avoid a >180° spin).
  const dYaw = Math.atan2(Math.sin(rawYaw - yaw), Math.cos(rawYaw - yaw));
  tween = {
    fromPos: { ...Transform.get(camEntity).position },
    toPos: { ...toPos },
    fromYaw: yaw,
    toYaw: yaw + dYaw,
    fromPitch: pitch,
    toPitch: clampPitch(Math.atan2(-lookDir.y, horiz)),
    elapsed: 0,
  };
}

/**
 * Frame a target world position with the editor camera (the inspector's
 * focusOnEntity). Enters free-cam if needed (so there's a camera we control),
 * then tweens to a standoff aimed at the target — keeping the current viewing
 * direction, pulling in if the target is far. The inspector supplies the world
 * position because the agent can't read the inspected scene's Transform.
 */
export function frameTarget(worldPos: { x: number; y: number; z: number }): void {
  if (camEntity === null) return;
  if (mode !== 'free') setCameraMode('free'); // seeds the pose from the live camera
  // The inspector's position is scene-local; add the offset to reach engine-world
  // (without this, focus frames a spot at the origin parcel, off the real scene).
  const target = Vector3.add(Vector3.create(worldPos.x, worldPos.y, worldPos.z), sceneOffset);
  const camPos = Transform.get(camEntity).position;
  const toTarget = Vector3.subtract(target, camPos);
  const dist = Vector3.length(toTarget);
  const dir = dist > 1e-3 ? Vector3.scale(toTarget, 1 / dist) : Vector3.Forward();
  const frameDist = Math.min(Math.max(dist, MIN_FRAME_DIST), MAX_FRAME_DIST);
  // Stand off from the target along the current view direction, looking at it.
  startTween(Vector3.subtract(target, Vector3.scale(dir, frameDist)), dir);
}

/**
 * Reset the editor camera to a default framing of the scene (toolbar / Space).
 * The inspector supplies the scene-local point to look at (its center); we tween
 * the fly-camera to a fixed elevated standoff looking down at it — a consistent
 * "home" view regardless of where the user flew.
 */
export function resetCamera(sceneLocalCenter: { x: number; y: number; z: number }): void {
  if (camEntity === null) return;
  if (mode !== 'free') setCameraMode('free');
  const center = Vector3.add(
    Vector3.create(sceneLocalCenter.x, sceneLocalCenter.y, sceneLocalCenter.z),
    sceneOffset,
  );
  // A ¾ overhead view: back on +Z, up on +Y — the usual editor "home" angle.
  const from = Vector3.add(center, Vector3.create(0, 12, 18));
  startTween(from, Vector3.subtract(center, from));
}

/** Fixed dolly distance per zoom step (toolbar button / one scroll notch). */
const ZOOM_STEP = 2; // metres

/**
 * Dolly the editor fly-camera along its look direction (toolbar zoom in/out).
 * `delta` > 0 zooms IN (forward), < 0 zooms OUT; magnitude is a step count. Zoom
 * only makes sense for the fly camera (the native avatar camera owns its own
 * scroll-zoom), so — like focus/reset — we engage free mode first, so the buttons
 * always do something visible. A running focus tween is cancelled so the dolly
 * takes effect immediately.
 */
export function zoomCamera(delta: number): void {
  if (camEntity === null || delta === 0) return;
  if (mode !== 'free') setCameraMode('free');
  tween = null;
  const t = Transform.getMutable(camEntity);
  const forward = Vector3.rotate(Vector3.Forward(), t.rotation as Quaternion);
  t.position = Vector3.add(t.position, Vector3.scale(forward, ZOOM_STEP * delta));
}

/** Install the fly-camera system + VirtualCamera. Call once on boot. */
export function setupCamera(): void {
  if (camEntity !== null) return;
  const cam = engine.addEntity();
  Transform.create(cam);
  VirtualCamera.create(cam, {});
  camEntity = cam;
  engine.addSystem(cameraSystem);
}

/** Enter/leave the editor fly-camera. `avatar` restores the native player cam. */
export function setCameraMode(next: CameraMode): void {
  if (camEntity === null || next === mode) return;

  if (next === 'free') {
    // Seed the fly pose from wherever the live camera is looking, then take over.
    const camT = Transform.getOrNull(engine.CameraEntity);
    const vt = Transform.getMutable(camEntity);
    if (camT !== null) {
      vt.position = { ...camT.position };
      aimAlong(Vector3.rotate(Vector3.Forward(), camT.rotation as Quaternion));
    }
    vt.rotation = lookRotation();
    MainCamera.createOrReplace(engine.CameraEntity, { virtualCameraEntity: camEntity });
  } else {
    MainCamera.deleteFrom(engine.CameraEntity);
  }
  mode = next;
  // Flip avatar input synchronously on the mode change (matching the original
  // behavior), and let the per-frame reconcile keep it converged.
  reconcileAvatarInput();
}

/**
 * Follow the camera mode: in AVATAR mode the player walks (WASD); in the editor
 * fly-camera its input is disabled so WASD drives the camera. Gated on the camera
 * mode ONLY — a frozen scene must still let the avatar walk around to inspect it
 * (walking is engine-native player movement, not a scene system). Idempotent, and
 * run every frame so a mode toggle always converges.
 */
function reconcileAvatarInput(): void {
  const enable = mode === 'avatar';
  if (enable === avatarWalkEnabled) return;
  avatarWalkEnabled = enable;
  if (enable) {
    InputModifier.deleteFrom(engine.PlayerEntity);
  } else {
    InputModifier.createOrReplace(engine.PlayerEntity, {
      mode: { $case: 'standard', standard: { disableAll: true } },
    });
  }
}

function cameraSystem(dt: number): void {
  try {
    reconcileAvatarInput();
    cameraSystemInner(dt);
  } catch (e) {
    // A throw here would halt the engine's system loop; keep it isolated.
    console.error('[bevy-agent camera] system error:', e);
  }
}

// Throttle the camera-pose stream to the inspector: the minimap only redraws at
// ~10Hz, so posting every frame is wasted bus traffic. Every ~6th frame (~10Hz at
// 60fps) is plenty for the minimap dot to track smoothly.
let poseTick = 0;

/** Stream the fly-camera's pose to the inspector (minimap) in SCENE-LOCAL coords
 * (subtract the scene offset — the inspector works in the scene's origin frame).
 * `target` is a point straight ahead of the camera (position + forward). */
function postCameraPose(): void {
  if (camEntity === null) return;
  const t = Transform.get(camEntity);
  const forward = Vector3.rotate(Vector3.Forward(), t.rotation as Quaternion);
  const posLocal = Vector3.subtract(t.position, sceneOffset);
  const tgtLocal = Vector3.add(posLocal, forward);
  bus.postToPage({
    kind: 'camera-pose',
    position: { x: posLocal.x, y: posLocal.y, z: posLocal.z },
    target: { x: tgtLocal.x, y: tgtLocal.y, z: tgtLocal.z },
  });
}

function cameraSystemInner(dt: number): void {
  if (camEntity === null || mode !== 'free') return;

  // Stream the pose to the inspector's minimap (throttled). Runs before the early
  // returns below so it fires regardless of the tween path.
  if (poseTick++ % 6 === 0) postCameraPose();

  // Mouse-look only while the pointer is locked (dragging to look), matching the
  // native camera's feel; otherwise the cursor is free for the tree/panels.
  const locked = PointerLock.getOrNull(engine.CameraEntity)?.isPointerLocked ?? false;
  const ptr = PrimaryPointerInfo.getOrNull(engine.RootEntity);
  const lookDx = locked ? (ptr?.screenDelta?.x ?? 0) : 0;
  const lookDy = locked ? (ptr?.screenDelta?.y ?? 0) : 0;

  const forwardKey = inputSystem.isPressed(InputAction.IA_FORWARD);
  const backKey = inputSystem.isPressed(InputAction.IA_BACKWARD);
  const rightKey = inputSystem.isPressed(InputAction.IA_RIGHT);
  const leftKey = inputSystem.isPressed(InputAction.IA_LEFT);
  // Up = Space (engine InputAction) OR E (host-forwarded); down = Q (host-forwarded).
  const upKey = inputSystem.isPressed(InputAction.IA_JUMP) || verticalUp;
  const downKey = verticalDown;
  const anyMove = forwardKey || backKey || rightKey || leftKey || upKey || downKey;

  // A focus tween eases to the framing pose; any manual input cancels it.
  if (tween !== null) {
    if (anyMove || lookDx !== 0 || lookDy !== 0) {
      tween = null;
    } else {
      tween.elapsed += dt;
      const u = Math.min(1, tween.elapsed / TWEEN_DURATION);
      const e = u * u * (3 - 2 * u); // smoothstep
      yaw = tween.fromYaw + (tween.toYaw - tween.fromYaw) * e;
      pitch = tween.fromPitch + (tween.toPitch - tween.fromPitch) * e;
      const tw = Transform.getMutable(camEntity);
      tw.position = Vector3.add(
        tween.fromPos,
        Vector3.scale(Vector3.subtract(tween.toPos, tween.fromPos), e),
      );
      tw.rotation = lookRotation();
      if (u >= 1) tween = null;
      return;
    }
  }

  yaw += lookDx * MOUSE_SENSITIVITY;
  pitch = clampPitch(pitch + lookDy * MOUSE_SENSITIVITY);

  const rotation = lookRotation();
  const forward = Vector3.rotate(Vector3.Forward(), rotation);
  const right = Vector3.rotate(Vector3.Right(), rotation);
  let move = Vector3.Zero();
  if (forwardKey) move = Vector3.add(move, forward);
  if (backKey) move = Vector3.subtract(move, forward);
  if (rightKey) move = Vector3.add(move, right);
  if (leftKey) move = Vector3.subtract(move, right);
  // Vertical: E / Space = up, Q = down (world up, not camera-relative — matches
  // Unity/Unreal fly verticals). E/Q arrive from the host (no SDK InputAction);
  // Space is the engine-read IA_JUMP folded into upKey above.
  if (upKey) move = Vector3.add(move, Vector3.Up());
  if (downKey) move = Vector3.subtract(move, Vector3.Up());

  const t = Transform.getMutable(camEntity);
  if (Vector3.lengthSquared(move) > 1e-6) {
    t.position = Vector3.add(t.position, Vector3.scale(Vector3.normalize(move), FLY_SPEED * dt));
  }
  t.rotation = rotation;
}
