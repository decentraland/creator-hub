import type { Entity } from '@dcl/sdk/ecs';
import { AudioSource, Transform } from '@dcl/sdk/ecs';
import { movePlayerTo } from '~system/RestrictedActions';

/**
 * A pad that respawns the player onto it. Call its Respawn action (for example from a health
 * bar's "when health reaches zero"), or describe a reaction for when the player respawns here.
 *
 * @event spawn
 * @param sound - Audio file played on respawn (in this item's folder). Leave empty for none.
 */
export class RespawnPad {
  private subs: Record<string, Array<(arg?: Entity) => void>> = {};

  constructor(
    public src: string, // DO NOT REMOVE
    public entity: Entity, // DO NOT REMOVE
    public sound: string = 'spawn.mp3',
  ) {}

  start() {
    if (this.sound) {
      AudioSource.createOrReplace(this.entity, {
        audioClipUrl: `${this.src}/${this.sound}`,
        playing: false,
      });
    }
  }

  /**
   * Moves the player onto the pad and fires the 'spawn' event.
   * @action
   */
  public respawn() {
    const { position } = Transform.get(this.entity);
    void movePlayerTo({ newRelativePosition: position });
    if (this.sound) {
      AudioSource.playSound(this.entity, `${this.src}/${this.sound}`);
    }
    for (const fn of this.subs.spawn ?? []) fn();
  }

  /** Subscribe a reaction to this item's events (currently 'spawn'). */
  onEvent(name: string, fn: (arg?: Entity) => void) {
    (this.subs[name] ??= []).push(fn);
  }
}
