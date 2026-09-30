import {
  AudioSource,
  ColliderLayer,
  engine,
  TriggerArea,
  triggerAreaEventsSystem,
} from '@dcl/sdk/ecs';
import type { Entity } from '@dcl/sdk/ecs';
import { Vector3 } from '@dcl/sdk/math';
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
// `damageTargets` is the shared registry the Health Bar (and any other target) adds itself to, so
// this reaches the exact same targets as every other combat item — script- or component-based.
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

export class Spikes {
  private inside = false;
  private timer = 0;

  /**
   * A tile of spikes that repeatedly damages whoever stands on it. Size the trigger area with the
   * scale gizmo. Use with the Health Bar smart item (parented to the player).
   *
   * @param damagePoints - How much damage each tick deals.
   * @param radius - How far from the tile the damage reaches.
   * @param interval - Seconds between damage ticks.
   * @param damageTarget - Who takes the damage.
   * @param sound - Audio file in this item's folder played on each tick (e.g. spikes.mp3). Empty for none.
   */
  constructor(
    public src: string, // DO NOT REMOVE
    public entity: Entity, // DO NOT REMOVE
    public damagePoints: number = 15,
    public radius: number = 5,
    public interval: number = 2,
    public damageTarget: 'all' | 'player' | 'non_player' = 'player',
    public sound: string = 'spikes.mp3',
  ) {}

  start() {
    TriggerArea.setBox(this.entity, ColliderLayer.CL_PLAYER);
    triggerAreaEventsSystem.onTriggerEnter(this.entity, event => {
      if (event.trigger?.entity === engine.PlayerEntity) {
        this.inside = true;
        this.timer = 0;
      }
    });
    triggerAreaEventsSystem.onTriggerExit(this.entity, event => {
      if (event.trigger?.entity === engine.PlayerEntity) this.inside = false;
    });
  }

  update(dt: number) {
    if (!this.inside) return;
    this.timer += dt;
    if (this.timer >= this.interval) {
      this.timer = 0;
      this.damage();
    }
  }

  /**
   * Deals one tick of damage in the area right now.
   * @action
   */
  public damage() {
    dealDamage(this.entity, this.radius, this.damagePoints, this.damageTarget);
    if (this.sound) AudioSource.playSound(this.entity, `${this.src}/${this.sound}`);
  }
}
