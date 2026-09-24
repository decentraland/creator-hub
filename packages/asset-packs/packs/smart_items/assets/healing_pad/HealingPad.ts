import {
  AudioSource,
  ColliderLayer,
  engine,
  TriggerArea,
  triggerAreaEventsSystem,
} from '@dcl/sdk/ecs';
import type { Entity } from '@dcl/sdk/ecs';
import { dealHealToPlayers } from '@dcl/asset-packs/dist/combat';

export class HealingPad {
  private inside = false;
  private timer = 0;

  /**
   * A pad that repeatedly heals the player while they stand on it. Size the trigger area with the
   * scale gizmo. Use with the Health Bar smart item (parented to the player).
   *
   * @param healPoints - How much health each tick restores.
   * @param interval - Seconds between heal ticks.
   * @param sound - Audio file in this item's folder played when the player steps on (e.g. heal.mp3). Empty for none.
   */
  constructor(
    public src: string, // DO NOT REMOVE
    public entity: Entity, // DO NOT REMOVE
    public healPoints: number = 5,
    public interval: number = 0.5,
    public sound: string = 'heal.mp3',
  ) {}

  start() {
    TriggerArea.setBox(this.entity, ColliderLayer.CL_PLAYER);
    triggerAreaEventsSystem.onTriggerEnter(this.entity, event => {
      if (event.trigger?.entity === engine.PlayerEntity) {
        this.inside = true;
        this.timer = 0;
        if (this.sound) AudioSource.playSound(this.entity, `${this.src}/${this.sound}`);
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
      this.heal();
    }
  }

  /**
   * Restores one tick of health to the player right now.
   * @action
   */
  public heal() {
    dealHealToPlayers(engine, this.entity, { multiplier: this.healPoints });
  }
}
