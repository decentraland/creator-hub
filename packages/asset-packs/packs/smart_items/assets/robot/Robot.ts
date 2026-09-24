import { Animator, engine, Transform } from '@dcl/sdk/ecs';
import type { Entity } from '@dcl/sdk/ecs';
import { Quaternion, Vector3 } from '@dcl/sdk/math';
import {
  registerDamageTarget,
  unregisterDamageTarget,
  onDamage,
  dealDamageInRadius,
} from '@dcl/asset-packs/dist/combat';
import { ProximityLayer } from '@dcl/asset-packs/dist/definitions';

export class Robot {
  private remaining = -1;
  private dead = false;
  private attackTimer = 0;
  private removeTimer = -1;
  // Reactions subscribe here (via getAllScriptInstances + onEvent).
  private subs: Record<string, Array<(arg?: Entity) => void>> = {};

  /**
   * An enemy robot that chases the player and attacks them, and has its own health so it can be
   * destroyed (e.g. with the Sword). Use with the Health Bar smart item for the player's health.
   *
   * @event death
   *
   * @param health - How many hits the robot takes before it's destroyed.
   * @param speed - How fast it moves toward the player (units per second).
   * @param followDistance - How close it gets before it stops moving in.
   * @param attackRadius - How close the player must be to take damage.
   * @param attackDamage - How much damage each attack deals.
   * @param attackInterval - Seconds between attacks.
   * @param attackAnimation - Animation clip played when it attacks.
   * @param deathAnimation - Animation clip played when it's destroyed.
   * @param removeAfter - Seconds after dying before the robot is removed.
   */
  constructor(
    public src: string, // DO NOT REMOVE
    public entity: Entity, // DO NOT REMOVE
    public health: number = 30,
    public speed: number = 1,
    public followDistance: number = 2,
    public attackRadius: number = 3,
    public attackDamage: number = 10,
    public attackInterval: number = 1,
    public attackAnimation: string = 'Attack',
    public deathAnimation: string = 'explode',
    public removeAfter: number = 0.5,
  ) {}

  start() {
    this.remaining = this.health;
    if (!Animator.getOrNull(this.entity)) Animator.create(this.entity, { states: [] });
    registerDamageTarget(this.entity);
    onDamage(this.entity, () => this.hit());
  }

  update(dt: number) {
    if (this.dead) {
      if (this.removeTimer < 0) return;
      this.removeTimer += dt;
      if (this.removeTimer >= this.removeAfter) {
        this.removeTimer = -1;
        engine.removeEntity(this.entity);
      }
      return;
    }
    this.followPlayer(dt);
    this.attackTimer += dt;
    if (this.attackTimer >= this.attackInterval) {
      this.attackTimer = 0;
      this.attack();
    }
  }

  private followPlayer(dt: number) {
    const player = Transform.getOrNull(engine.PlayerEntity);
    const self = Transform.getMutableOrNull(this.entity);
    if (!player || !self) return;
    // Move on the ground plane only (ignore the player's height).
    const target = Vector3.create(player.position.x, self.position.y, player.position.z);
    const distance = Vector3.distance(self.position, target);
    if (distance > this.followDistance) {
      const direction = Vector3.normalize(Vector3.subtract(target, self.position));
      const step = Math.min(this.speed * dt, distance - this.followDistance);
      self.position = Vector3.add(self.position, Vector3.scale(direction, step));
    }
    self.rotation = Quaternion.fromLookAt(self.position, target);
  }

  private attack() {
    const player = Transform.getOrNull(engine.PlayerEntity);
    const self = Transform.getOrNull(this.entity);
    if (player && self && Vector3.distance(self.position, player.position) <= this.attackRadius) {
      this.playAnimation(this.attackAnimation);
    }
    dealDamageInRadius(engine, this.entity, {
      radius: this.attackRadius,
      hits: this.attackDamage,
      layer: ProximityLayer.PLAYER,
    });
  }

  private hit() {
    if (this.dead) return;
    this.remaining -= 1;
    if (this.remaining <= 0) this.die();
  }

  /**
   * Destroys the robot: plays the death animation and removes it.
   * @action
   */
  public die() {
    if (this.dead) return;
    this.dead = true;
    unregisterDamageTarget(this.entity);
    this.playAnimation(this.deathAnimation);
    for (const fn of this.subs.death ?? []) fn();
    this.removeTimer = 0;
  }

  /** Subscribe a reaction to this item's events (currently 'death'). */
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
