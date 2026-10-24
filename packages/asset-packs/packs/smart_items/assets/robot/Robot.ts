import { Animator, engine, Transform } from '@dcl/sdk/ecs';
import type { Entity } from '@dcl/sdk/ecs';
import { Quaternion, Vector3 } from '@dcl/sdk/math';
import { getTriggerEvents } from '@dcl/asset-packs/dist/events';
import { getExplorerComponents } from '@dcl/asset-packs/dist/components';
import {
  getWorldPosition,
  getPlayerPosition,
  getEntityParent,
} from '@dcl/asset-packs/dist/helpers';
import { TriggerType } from '@dcl/asset-packs/dist/definitions';
import { damageTargets } from '@dcl/asset-packs/dist/triggers';

// Deal damage to every registered target within `radius`, `hits` times each, honoring who to hit.
// `damageTargets` is the shared registry every target (incl. a player-parented Health Bar) adds
// itself to, so the robot's attack reaches the same targets as every other combat item.
function dealDamage(
  from: Entity,
  radius: number,
  hits: number,
  target: 'all' | 'player' | 'non_player',
) {
  const { AvatarAttach } = getExplorerComponents(engine);
  const origin = AvatarAttach.has(from) ? getPlayerPosition() : getWorldPosition(from);
  for (const entity of damageTargets) {
    if (entity === from) continue; // never damage ourselves
    if (target !== 'all') {
      let root = entity;
      for (let parent = getEntityParent(root); parent; parent = getEntityParent(root))
        root = parent;
      const isPlayer = root === engine.PlayerEntity || root === engine.CameraEntity;
      if (target === 'player' && !isPlayer) continue;
      if (target === 'non_player' && isPlayer) continue;
    }
    if (Vector3.distance(origin, getWorldPosition(entity)) <= Math.max(radius, 0)) {
      for (let i = 0; i < Math.max(hits, 1); i++)
        getTriggerEvents(entity).emit(TriggerType.ON_DAMAGE);
    }
  }
}

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
    // Join the shared damage registry so weapons (e.g. the Sword) can hit us, and react to each hit.
    damageTargets.add(this.entity);
    getTriggerEvents(this.entity).on(TriggerType.ON_DAMAGE, () => this.hit());
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
    dealDamage(this.entity, this.attackRadius, this.attackDamage, 'player');
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
    damageTargets.delete(this.entity);
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
