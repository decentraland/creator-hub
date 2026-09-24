import { engine } from '@dcl/sdk/ecs';
import type { Entity } from '@dcl/sdk/ecs';
import { syncEntity } from '@dcl/sdk/network';
import { getComponents } from '@dcl/asset-packs/dist/definitions';

export class HealthBar {
  // Reactions subscribe here (via getAllScriptInstances + onEvent); the actions fan out to them.
  private subs: Record<string, Array<(arg?: Entity) => void>> = {};

  /**
   * A health bar that tracks a health value (0–max) and shows it as a floating bar. Other smart
   * items change it: spikes and enemies deal damage, the First Aid and Healing Pad heal. Parent
   * this item to the Player to use it as the player's health.
   *
   * The value is shared with other players, so everyone sees the same bar. The bar itself is drawn
   * by the shared Counter Bar renderer — this script just owns the value and the reactions.
   *
   * @event damaged
   * @event healed
   * @event death
   *
   * @param maxHealth - The full health value the bar represents.
   * @param startHealth - The health value the bar starts at.
   * @param primaryColor - Hex colour of the filled part of the bar (e.g. #00FF00).
   * @param secondaryColor - Hex colour of the empty part of the bar (e.g. #FF0000).
   * @param showBar - Show the floating bar. Turn off to track health without a visual.
   */
  constructor(
    public src: string, // DO NOT REMOVE
    public entity: Entity, // DO NOT REMOVE
    public maxHealth: number = 100,
    public startHealth: number = 100,
    public primaryColor: string = '#00FF00',
    public secondaryColor: string = '#FF0000',
    public showBar: boolean = true,
  ) {}

  start() {
    const { Counter, CounterBar } = getComponents(engine);
    if (!Counter.getOrNull(this.entity)) {
      Counter.create(this.entity, { id: this.entity, value: this.clamp(this.startHealth) });
    }
    if (this.showBar && !CounterBar.getOrNull(this.entity)) {
      CounterBar.create(this.entity, {
        maxValue: this.maxHealth,
        primaryColor: this.primaryColor,
        secondaryColor: this.secondaryColor,
      });
    }
    // Share the health value so every player sees the same bar.
    syncEntity(this.entity, [Counter.componentId], this.entity);
  }

  /**
   * Increases health by an amount (default 1), up to the maximum.
   * @action
   */
  public heal(amount: number = 1) {
    this.setValue(this.getValue() + amount);
    for (const fn of this.subs.healed ?? []) fn();
  }

  /**
   * Decreases health by an amount (default 1), down to zero; fires "death" when it reaches zero.
   * @action
   */
  public damage(amount: number = 1) {
    const next = this.getValue() - amount;
    this.setValue(next);
    for (const fn of this.subs.damaged ?? []) fn();
    if (next <= 0) for (const fn of this.subs.death ?? []) fn();
  }

  /**
   * Resets health back to the maximum.
   * @action
   */
  public reset() {
    this.setValue(this.maxHealth);
  }

  /**
   * Removes this health bar from the scene.
   * @action
   */
  public remove() {
    engine.removeEntity(this.entity);
  }

  /** Subscribe a reaction to this item's events ('damaged' / 'healed' / 'death'). */
  onEvent(name: string, fn: (arg?: Entity) => void) {
    (this.subs[name] ??= []).push(fn);
  }

  private getValue(): number {
    const { Counter } = getComponents(engine);
    return Counter.getOrNull(this.entity)?.value ?? 0;
  }

  private setValue(value: number) {
    const { Counter } = getComponents(engine);
    const counter = Counter.getMutableOrNull(this.entity);
    if (counter) counter.value = this.clamp(value);
  }

  private clamp(value: number): number {
    return Math.max(0, Math.min(this.maxHealth, value));
  }
}
