import { Animator, engine } from '@dcl/sdk/ecs';
import type { Entity } from '@dcl/sdk/ecs';
import {
  registerDamageTarget,
  unregisterDamageTarget,
  onDamage,
  dealDamageInRadius,
} from '@dcl/asset-packs/dist/combat';
import type { ProximityLayer } from '@dcl/asset-packs/dist/definitions';

export class Barrel {
  private remaining = -1;
  private exploded = false;
  private removeTimer = -1;
  // Reactions subscribe here (via getAllScriptInstances + onEvent).
  private subs: Record<string, Array<(arg?: Entity) => void>> = {};

  /**
   * An exploding barrel with its own health. Damage it (e.g. with the Sword) to destroy it; when it
   * runs out of health it plays an explosion, deals area damage to everything nearby, then
   * disappears.
   *
   * @event exploded
   *
   * @param health - How many hits the barrel takes before it explodes.
   * @param explosionRadius - How far the explosion's damage reaches.
   * @param explosionDamage - How much damage the explosion deals to each target.
   * @param explosionTarget - Who the explosion damages.
   * @param animation - Animation clip played when it explodes.
   * @param removeAfter - Seconds after exploding before the barrel is removed.
   */
  constructor(
    public src: string, // DO NOT REMOVE
    public entity: Entity, // DO NOT REMOVE
    public health: number = 30,
    public explosionRadius: number = 10,
    public explosionDamage: number = 30,
    public explosionTarget: 'all' | 'player' | 'non_player' = 'all',
    public animation: string = 'Animation',
    public removeAfter: number = 0.5,
  ) {}

  start() {
    this.remaining = this.health;
    if (!Animator.getOrNull(this.entity)) Animator.create(this.entity, { states: [] });
    registerDamageTarget(this.entity);
    onDamage(this.entity, () => this.hit());
  }

  update(dt: number) {
    if (this.removeTimer < 0) return;
    this.removeTimer += dt;
    if (this.removeTimer >= this.removeAfter) {
      this.removeTimer = -1;
      engine.removeEntity(this.entity);
    }
  }

  private hit() {
    if (this.exploded) return;
    this.remaining -= 1;
    if (this.remaining <= 0) this.explode();
  }

  /**
   * Explodes the barrel: plays the animation, deals area damage, then removes it.
   * @action
   */
  public explode() {
    if (this.exploded) return;
    this.exploded = true;
    unregisterDamageTarget(this.entity); // don't damage ourselves in the blast
    this.playAnimation(this.animation);
    dealDamageInRadius(engine, this.entity, {
      radius: this.explosionRadius,
      hits: this.explosionDamage,
      layer: this.explosionTarget as ProximityLayer,
    });
    for (const fn of this.subs.exploded ?? []) fn();
    this.removeTimer = 0;
  }

  /** Subscribe a reaction to this item's events (currently 'exploded'). */
  onEvent(name: string, fn: (arg?: Entity) => void) {
    (this.subs[name] ??= []).push(fn);
  }

  private playAnimation(clip: string) {
    if (!clip) return;
    const animator = Animator.getMutable(this.entity);
    if (!animator.states.some((s: { clip: string }) => s.clip === clip)) {
      animator.states = [...animator.states, { clip, playing: false, loop: false }];
    }
    Animator.playSingleAnimation(this.entity, clip);
  }
}
