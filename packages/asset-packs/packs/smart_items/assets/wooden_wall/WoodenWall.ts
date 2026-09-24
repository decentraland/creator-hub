import { Animator, AudioSource } from '@dcl/sdk/ecs';
import type { Entity } from '@dcl/sdk/ecs';
import {
  registerDamageTarget,
  unregisterDamageTarget,
  onDamage,
} from '@dcl/asset-packs/dist/combat';

export class WoodenWall {
  private remaining = -1;
  private destroyed = false;
  // Reactions subscribe here (via getAllScriptInstances + onEvent).
  private subs: Record<string, Array<(arg?: Entity) => void>> = {};

  /**
   * A destructible wooden fence with its own health. Damage it (e.g. with the Sword) to knock it
   * down; it plays a hit animation on each hit it survives and a fall animation + sound when it's
   * destroyed.
   *
   * @event destroyed
   *
   * @param health - How many hits the fence takes before it falls.
   * @param hitAnimation - Animation clip played on each hit it survives.
   * @param fallAnimation - Animation clip played when it's destroyed.
   * @param fallSound - Audio file played when it falls (e.g. fall.mp3). Empty for none.
   */
  constructor(
    public src: string, // DO NOT REMOVE
    public entity: Entity, // DO NOT REMOVE
    public health: number = 30,
    public hitAnimation: string = 'Hit',
    public fallAnimation: string = 'Fall',
    public fallSound: string = 'fall.mp3',
  ) {}

  start() {
    this.remaining = this.health;
    if (!Animator.getOrNull(this.entity)) Animator.create(this.entity, { states: [] });
    registerDamageTarget(this.entity);
    onDamage(this.entity, () => this.hit());
  }

  private hit() {
    if (this.destroyed) return;
    this.remaining -= 1;
    if (this.remaining <= 0) this.destroy();
    else this.playAnimation(this.hitAnimation);
  }

  /**
   * Knocks the fence down: plays the fall animation and sound.
   * @action
   */
  public destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    unregisterDamageTarget(this.entity);
    this.playAnimation(this.fallAnimation);
    if (this.fallSound) AudioSource.playSound(this.entity, `${this.src}/${this.fallSound}`);
    for (const fn of this.subs.destroyed ?? []) fn();
  }

  /** Subscribe a reaction to this item's events (currently 'destroyed'). */
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
