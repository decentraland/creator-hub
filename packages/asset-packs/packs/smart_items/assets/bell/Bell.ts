import type { Entity } from '@dcl/sdk/ecs';
import { Animator, AudioSource, InputAction, pointerEventsSystem } from '@dcl/sdk/ecs';
import type { ActionCallback } from '~sdk/script-utils';

export class Bell {
  /**
   * A bell that rings when clicked, playing its animation and sound. Other smart
   * items can also ring it.
   *
   * @param hoverText - Text shown when the player points at the bell.
   * @param sound - Name of an audio file inside this smart item's folder (e.g. bell.mp3), played when the bell rings. Leave empty for no sound.
   * @param animation - Name of the animation clip in the bell's model that plays when the bell rings. Leave empty for no animation.
   * @param onRing - Action triggered every time the bell rings.
   */
  constructor(
    public src: string, // DO NOT REMOVE
    public entity: Entity, // DO NOT REMOVE
    public hoverText: string = 'Ring',
    public sound: string = 'bell.mp3',
    public animation: string = 'trigger',
    public onRing?: ActionCallback,
  ) {}

  /**
   * Start function - called when the script is initialized
   */
  start() {
    if (!Animator.getOrNull(this.entity)) {
      Animator.create(this.entity, { states: [] });
    }
    pointerEventsSystem.onPointerDown(
      {
        entity: this.entity,
        opts: {
          button: InputAction.IA_PRIMARY,
          hoverText: this.hoverText,
          maxDistance: 10,
        },
      },
      () => this.ring(),
    );
  }

  /**
   * Rings the bell, playing its animation and sound
   * @action
   */
  public ring() {
    if (this.animation) {
      const animator = Animator.getMutable(this.entity);
      if (!animator.states.some((s: { clip: string }) => s.clip === this.animation)) {
        animator.states = [
          ...animator.states,
          { clip: this.animation, playing: false, loop: false },
        ];
      }
      Animator.playSingleAnimation(this.entity, this.animation);
    }
    if (this.sound) {
      // playSound resets currentTime so the sound replays from the start
      AudioSource.playSound(this.entity, `${this.src}/${this.sound}`);
    }
    if (this.onRing) this.onRing();
  }
}
