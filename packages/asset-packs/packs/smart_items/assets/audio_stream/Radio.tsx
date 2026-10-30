import type { Entity } from '@dcl/sdk/ecs';
import { AudioStream, InputAction, pointerEventsSystem } from '@dcl/sdk/ecs';

/**
 * A clickable object that plays or stops a streaming audio source. Click it to toggle.
 * The stream URL lives in the AudioStream component — edit it there.
 *
 * @event click
 * @param hoverText - Text shown when the player points at it.
 */
export class Radio {
  private subs: Record<string, Array<(arg?: Entity) => void>> = {};

  constructor(
    public src: string, // DO NOT REMOVE
    public entity: Entity, // DO NOT REMOVE
    public hoverText: string = 'Play / Stop',
  ) {}

  start() {
    // Start stopped; clicking toggles it on.
    const stream = AudioStream.getMutableOrNull(this.entity);
    if (stream) stream.playing = false;

    pointerEventsSystem.onPointerDown(
      {
        entity: this.entity,
        opts: {
          button: InputAction.IA_POINTER,
          hoverText: this.hoverText,
          maxDistance: 10,
        },
      },
      () => this.toggle(),
    );
  }

  /**
   * Toggles the audio stream on/off.
   * @action
   */
  public toggle() {
    const stream = AudioStream.getMutableOrNull(this.entity);
    if (stream) stream.playing = !stream.playing;
    for (const fn of this.subs.click ?? []) fn();
  }

  /** Subscribe a reaction to this item's events (currently 'click'). */
  onEvent(name: string, fn: (arg?: Entity) => void) {
    (this.subs[name] ??= []).push(fn);
  }
}
