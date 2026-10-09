import { engine, InputAction, pointerEventsSystem } from '@dcl/sdk/ecs';
import type { Entity } from '@dcl/sdk/ecs';
import { getTriggerEvents } from '@dcl/asset-packs/dist/events';
import { getEntityParent } from '@dcl/asset-packs/dist/helpers';
import { TriggerType } from '@dcl/asset-packs/dist/definitions';
import { healTargets } from '@dcl/asset-packs/dist/triggers';

// Heal every player-rooted target `points` times (each emit is +1 on the target's own health).
// `healTargets` is the shared registry a player-parented Health Bar adds itself to, so this works
// with both component-based and script-based Health Bars.
function dealHeal(points: number) {
  for (const entity of healTargets) {
    let root = entity;
    for (let parent = getEntityParent(root); parent; parent = getEntityParent(root)) root = parent;
    if (root !== engine.PlayerEntity) continue;
    for (let i = 0; i < Math.max(points, 1); i++)
      getTriggerEvents(entity).emit(TriggerType.ON_HEAL_PLAYER);
  }
}

export class FirstAid {
  // Reactions subscribe here (via getAllScriptInstances + onEvent); heal() fans out to them.
  private subs: Record<string, Array<(arg?: Entity) => void>> = {};

  /**
   * A one-time first aid kit. Click it to restore the player's health (any Health Bar parented to
   * the player), then it disappears. Heals through the shared combat registry, so it works with
   * both component-based and script-based Health Bars.
   *
   * @event healed
   *
   * @param healingPoints - How much health to restore when used.
   * @param hoverText - Text shown when the player points at the kit.
   * @param removeOnUse - Remove the kit after it's used.
   */
  constructor(
    public src: string, // DO NOT REMOVE
    public entity: Entity, // DO NOT REMOVE
    public healingPoints: number = 100,
    public hoverText: string = 'Heal',
    public removeOnUse: boolean = true,
  ) {}

  start() {
    pointerEventsSystem.onPointerDown(
      {
        entity: this.entity,
        opts: { button: InputAction.IA_PRIMARY, hoverText: this.hoverText, maxDistance: 10 },
      },
      () => this.heal(),
    );
  }

  /**
   * Heals the player and, if enabled, removes the kit.
   * @action
   */
  public heal() {
    dealHeal(this.healingPoints);
    for (const fn of this.subs.healed ?? []) fn();
    if (this.removeOnUse) engine.removeEntity(this.entity);
  }

  /** Subscribe a reaction to this item's events (currently 'healed'). */
  onEvent(name: string, fn: (arg?: Entity) => void) {
    (this.subs[name] ??= []).push(fn);
  }
}
