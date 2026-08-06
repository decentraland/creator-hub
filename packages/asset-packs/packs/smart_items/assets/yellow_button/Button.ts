import type { Entity, InputAction } from '@dcl/sdk/ecs';
import { Animator, AudioSource, pointerEventsSystem } from '@dcl/sdk/ecs';
import type { ActionCallback } from '~sdk/script-utils';

export class Button {
  /**
   * A button that players can press to trigger an action on any smart item.
   * Pressing it plays the button's press animation and sound.
   *
   * @param hoverText - Text shown when the player points at the button.
   * @param onClick - Action triggered every time the button is pressed.
   * @param inputButton - Input that presses the button: 0 = mouse click, 1 = E key, 2 = F key.
   * @param sound - Name of an audio file inside this smart item's folder (e.g. sound.mp3), played whenever the button is pressed. Leave empty for no sound.
   * @param animation - Name of the animation clip in the button's model that plays when the button is pressed. Leave empty for no animation.
   */
  constructor(
    public src: string, // DO NOT REMOVE
    public entity: Entity, // DO NOT REMOVE
    public hoverText: string = 'Press',
    public onClick?: ActionCallback,
    public inputButton: number = 1,
    public sound: string = 'sound.mp3',
    public animation: string = 'trigger',
  ) {}

  /**
   * Start function - called when the script is initialized
   */
  start() {
    if (this.animation) {
      Animator.createOrReplace(this.entity, {
        states: [{ clip: this.animation, playing: false, loop: false }],
      });
    }
    if (this.sound) {
      AudioSource.createOrReplace(this.entity, {
        audioClipUrl: `${this.src}/${this.sound}`,
        playing: false,
      });
    }
    pointerEventsSystem.onPointerDown(
      {
        entity: this.entity,
        opts: {
          button: this.inputButton as InputAction,
          hoverText: this.hoverText,
          maxDistance: 10,
        },
      },
      () => this.press(),
    );
  }

  /**
   * Presses the button, playing its animation and sound and triggering its On Click action
   * @action
   */
  public press() {
    if (this.animation) {
      // shouldReset makes the renderer restart the clip from the beginning even
      // though `playing` never transitions in the CRDT state between presses
      Animator.playSingleAnimation(this.entity, this.animation);
    }
    if (this.sound) {
      // playSound resets currentTime so the sound replays from the start
      AudioSource.playSound(this.entity, `${this.src}/${this.sound}`);
    }
    if (this.onClick) this.onClick();
  }
}
