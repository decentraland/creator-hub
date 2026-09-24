import {
  AudioSource,
  ColliderLayer,
  engine,
  TriggerArea,
  triggerAreaEventsSystem,
} from '@dcl/sdk/ecs';
import type { Entity } from '@dcl/sdk/ecs';
import { dealDamageInRadius } from '@dcl/asset-packs/dist/combat';
import type { ProximityLayer } from '@dcl/asset-packs/dist/definitions';

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
    dealDamageInRadius(engine, this.entity, {
      radius: this.radius,
      hits: this.damagePoints,
      layer: this.damageTarget as ProximityLayer,
    });
    if (this.sound) AudioSource.playSound(this.entity, `${this.src}/${this.sound}`);
  }
}
