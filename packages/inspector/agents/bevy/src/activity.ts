import { engine, Transform } from '@dcl/sdk/ecs';
import { Vector3 } from '@dcl/sdk/math';
import type { BusActivity, BusVec3 } from '@dcl/inspector-bevy-protocol';

import { bus } from './bus';

/**
 * Session-recorder activity reporting: what the pointer is over, clicks that reach
 * the running scene, and where the player walks. Off until the host sends
 * `set-activity-reporting` (the hover raycast it needs would otherwise run every few
 * frames while editing, for nobody).
 *
 * Holds the on/off switch and the agent's view of the frozen state, so gizmo.tsx
 * (which owns the pointer raycasts) and the player-move system here share them. The
 * scene offset lives in gizmo.tsx, which imports this module, so it is injected into
 * `setupActivityReporting` rather than imported back.
 */

const PLAYER_MOVE_INTERVAL = 0.5; // seconds
const PLAYER_MOVE_MIN_DISTANCE = 0.25; // metres

let reporting = false;
// The editor boots frozen; the host's `set-scene-frozen` keeps this in step.
let sceneFrozen = true;
let lastPointerTargetKey: string | null = null;
let lastPlayerPosition: Vector3 | null = null;
let sincePlayerSample = 0;

/** A raycast resolved for reporting: entity 0 = nothing pickable. */
export interface ActivityHit {
  entity: number;
  point?: BusVec3;
  meshName?: string;
}

export function isActivityReporting(): boolean {
  return reporting;
}

export function isActivitySceneRunning(): boolean {
  return !sceneFrozen;
}

export function setActivityReporting(enabled: boolean): void {
  reporting = enabled;
  // A new subscriber must hear the current target and position, not be deduped
  // against what an earlier one was told.
  lastPointerTargetKey = null;
  lastPlayerPosition = null;
}

export function setActivitySceneFrozen(frozen: boolean): void {
  if (frozen === sceneFrozen) return;
  sceneFrozen = frozen;
  // On Play, report where the player starts before any movement.
  lastPlayerPosition = null;
  sincePlayerSample = PLAYER_MOVE_INTERVAL;
}

/** Report the scene entity under the pointer — only when it changed. A different mesh
 * of the same entity counts as a change: for an entity the scene spawned at runtime the
 * mesh name is the only handle the host gets. */
export function reportPointerTarget(hit: ActivityHit): void {
  if (!reporting) return;
  const key = `${hit.entity}|${hit.meshName ?? ''}`;
  if (key === lastPointerTargetKey) return;
  lastPointerTargetKey = key;
  post({ kind: 'pointerTarget', ...hit });
}

export function reportSceneClick(hit: ActivityHit): void {
  if (!reporting || sceneFrozen) return;
  post({ kind: 'sceneClick', ...hit });
}

/** Install the player-move sampler. `getSceneOffset` converts world to scene-local. */
export function setupActivityReporting(getSceneOffset: () => Vector3): void {
  engine.addSystem((dt: number) => {
    try {
      samplePlayerPosition(dt, getSceneOffset());
    } catch (e) {
      console.error('[bevy-agent activity] system error:', e);
    }
  });
}

function samplePlayerPosition(dt: number, sceneOffset: Vector3): void {
  if (!reporting || sceneFrozen) return;
  sincePlayerSample += dt;
  if (sincePlayerSample < PLAYER_MOVE_INTERVAL) return;
  sincePlayerSample = 0;
  const player = Transform.getOrNull(engine.PlayerEntity);
  if (player === null) return;
  const local = Vector3.subtract(player.position, sceneOffset);
  if (
    lastPlayerPosition !== null &&
    Vector3.distance(local, lastPlayerPosition) <= PLAYER_MOVE_MIN_DISTANCE
  ) {
    return;
  }
  lastPlayerPosition = local;
  post({ kind: 'playerMove', position: { x: local.x, y: local.y, z: local.z } });
}

function post(activity: BusActivity): void {
  bus.postToPage({ kind: 'activity', activity });
}
