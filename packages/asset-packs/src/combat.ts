import type { Entity, IEngine } from '@dcl/ecs';
import { getComponentEntityTree } from '@dcl/ecs';
import { Vector3 } from '@dcl/sdk/math';
import { getEntityParent, getPlayerPosition, getWorldPosition } from './helpers';
import { getExplorerComponents } from './components';
import { getTriggerEvents } from './events';
import { ProximityLayer, TriggerType } from './definitions';
import { damageTargets, healTargets } from './triggers';

// The shared damage/heal contract. "Player health" is a scene-side Counter on an entity parented
// to the player; combat routes through the module-global `damageTargets`/`healTargets` sets. These
// helpers are the single mechanism both the built-in DAMAGE/HEAL actions AND script-based combat
// items use, so migrated (script) and not-yet-migrated (component) items keep hitting/healing the
// same targets. A script imports these from `@dcl/asset-packs/dist/combat`.

export type DamageOptions = { radius: number; layer?: ProximityLayer; hits?: number };
export type HealOptions = { multiplier?: number };

function getRoot(entity: Entity): Entity {
  const parent = getEntityParent(entity);
  return !parent ? entity : getRoot(parent);
}

/** Register/unregister an entity so weapons in range can damage it (fires its `on_damage`). */
export function registerDamageTarget(entity: Entity): void {
  damageTargets.add(entity);
}
export function unregisterDamageTarget(entity: Entity): void {
  damageTargets.delete(entity);
}
/** Register/unregister a player-rooted entity so heal dealers can heal it (fires `on_heal_player`). */
export function registerHealTarget(entity: Entity): void {
  healTargets.add(entity);
}
export function unregisterHealTarget(entity: Entity): void {
  healTargets.delete(entity);
}

/** Subscribe to this entity being damaged / healed (the same events the trigger runtime emits). */
export function onDamage(entity: Entity, cb: () => void): void {
  getTriggerEvents(entity).on(TriggerType.ON_DAMAGE, cb);
}
export function onHeal(entity: Entity, cb: () => void): void {
  getTriggerEvents(entity).on(TriggerType.ON_HEAL_PLAYER, cb);
}

/**
 * Damages every registered target within `radius` of `originEntity`, honoring the proximity `layer`
 * filter, `hits` times each. Skips the origin's own entity tree. This is the extracted body of the
 * built-in DAMAGE action, so a script weapon and a component weapon hit the exact same targets.
 */
export function dealDamageInRadius(
  engine: IEngine,
  originEntity: Entity,
  { radius, layer, hits }: DamageOptions,
): void {
  const { Transform, AvatarAttach } = getExplorerComponents(engine);
  const originPosition = AvatarAttach.has(originEntity)
    ? getPlayerPosition()
    : getWorldPosition(originEntity);
  const originTree = Array.from(getComponentEntityTree(engine, originEntity, Transform));

  for (const target of damageTargets) {
    if (originTree.some(e => e === target)) continue; // don't damage self/children
    if (layer === ProximityLayer.PLAYER) {
      const root = getRoot(target);
      if (root !== engine.PlayerEntity && root !== engine.CameraEntity) continue;
    } else if (layer === ProximityLayer.NON_PLAYER) {
      const root = getRoot(target);
      if (root === engine.PlayerEntity || root === engine.CameraEntity) continue;
    }
    if (Vector3.distance(originPosition, getWorldPosition(target)) <= radius) {
      const total = hits === undefined ? 1 : Math.max(hits, 1);
      for (let i = 0; i < total; i++) getTriggerEvents(target).emit(TriggerType.ON_DAMAGE);
    }
  }
}

/**
 * Heals every registered player-rooted target `multiplier` times (each emit is +1 on the target's
 * own health). Extracted body of the built-in HEAL_PLAYER action.
 */
export function dealHealToPlayers(
  engine: IEngine,
  _originEntity: Entity,
  { multiplier }: HealOptions = {},
): void {
  for (const target of healTargets) {
    if (getRoot(target) !== engine.PlayerEntity) continue;
    const total = Math.max(multiplier ?? 1, 1);
    for (let i = 0; i < total; i++) getTriggerEvents(target).emit(TriggerType.ON_HEAL_PLAYER);
  }
}
