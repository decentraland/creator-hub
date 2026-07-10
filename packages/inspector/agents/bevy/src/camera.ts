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

let camEntity: Entity | null = null;
let mode: CameraMode = 'avatar';
let yaw = 0;
let pitch = 0;
let avatarInputDisabled = false;

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
    setAvatarInput(false);
  } else {
    MainCamera.deleteFrom(engine.CameraEntity);
    setAvatarInput(true);
  }
  mode = next;
}

/** Disable/enable the avatar's movement input (so WASD drives the camera, not it). */
function setAvatarInput(enabled: boolean): void {
  if (enabled === !avatarInputDisabled) return;
  avatarInputDisabled = !enabled;
  if (enabled) {
    InputModifier.deleteFrom(engine.PlayerEntity);
  } else {
    InputModifier.createOrReplace(engine.PlayerEntity, {
      mode: { $case: 'standard', standard: { disableAll: true } },
    });
  }
}

function cameraSystem(dt: number): void {
  try {
    cameraSystemInner(dt);
  } catch (e) {
    // A throw here would halt the engine's system loop; keep it isolated.
    console.error('[bevy-agent camera] system error:', e);
  }
}

function cameraSystemInner(dt: number): void {
  if (camEntity === null || mode !== 'free') return;

  // Mouse-look only while the pointer is locked (dragging to look), matching the
  // native camera's feel; otherwise the cursor is free for the tree/panels.
  const locked = PointerLock.getOrNull(engine.CameraEntity)?.isPointerLocked ?? false;
  const ptr = PrimaryPointerInfo.getOrNull(engine.RootEntity);
  const lookDx = locked ? (ptr?.screenDelta?.x ?? 0) : 0;
  const lookDy = locked ? (ptr?.screenDelta?.y ?? 0) : 0;
  yaw += lookDx * MOUSE_SENSITIVITY;
  pitch = clampPitch(pitch + lookDy * MOUSE_SENSITIVITY);

  const rotation = lookRotation();
  const forward = Vector3.rotate(Vector3.Forward(), rotation);
  const right = Vector3.rotate(Vector3.Right(), rotation);
  let move = Vector3.Zero();
  if (inputSystem.isPressed(InputAction.IA_FORWARD)) move = Vector3.add(move, forward);
  if (inputSystem.isPressed(InputAction.IA_BACKWARD)) move = Vector3.subtract(move, forward);
  if (inputSystem.isPressed(InputAction.IA_RIGHT)) move = Vector3.add(move, right);
  if (inputSystem.isPressed(InputAction.IA_LEFT)) move = Vector3.subtract(move, right);
  // Jump = up. (No dedicated "down" input action in this SDK; vertical-down can
  // come with orbit/dolly in a later slice.)
  if (inputSystem.isPressed(InputAction.IA_JUMP)) move = Vector3.add(move, Vector3.Up());

  const t = Transform.getMutable(camEntity);
  if (Vector3.lengthSquared(move) > 1e-6) {
    t.position = Vector3.add(t.position, Vector3.scale(Vector3.normalize(move), FLY_SPEED * dt));
  }
  t.rotation = rotation;
}
