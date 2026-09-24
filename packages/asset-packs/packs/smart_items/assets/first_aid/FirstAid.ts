import { engine, InputAction, pointerEventsSystem } from '@dcl/sdk/ecs';
import type { Entity } from '@dcl/sdk/ecs';
import { dealHealToPlayers } from '@dcl/asset-packs/dist/combat';

export class FirstAid {
  // Reactions subscribe here (via getAllScriptInstances + onEvent); heal() fans out to them.
  private subs: Record<string, Array<(arg?: Entity) => void>> = {};

  /**
   * A one-time first aid kit. Click it to restore the player's health (any Health Bar parented to
   * the player), then it disappears. Heals through the shared combat contract, so it works with
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
    dealHealToPlayers(engine, this.entity, { multiplier: this.healingPoints });
    for (const fn of this.subs.healed ?? []) fn();
    if (this.removeOnUse) engine.removeEntity(this.entity);
  }

  /** Subscribe a reaction to this item's events (currently 'healed'). */
  onEvent(name: string, fn: (arg?: Entity) => void) {
    (this.subs[name] ??= []).push(fn);
  }
}
