import type { Entity } from '@dcl/sdk/ecs';
import { Animator, AudioSource, engine, InputAction, pointerEventsSystem } from '@dcl/sdk/ecs';
import { getComponents } from '@dcl/asset-packs/dist/definitions';

export class Alarm {
  private lastState: string = '';

  /**
   * An alarm that loops its animation and sound while triggered. Trigger and disarm
   * it from other smart items, for example a trigger area or a button. Its state is
   * shared with other players, so everyone hears the same alarm.
   *
   * @param activateAnimation - Name of the animation clip in the alarm's model, looped while the alarm is triggered.
   * @param idleAnimation - Name of an animation clip to play when the alarm is disarmed or the scene loads, to set the resting pose. Leave empty for none.
   * @param sound - Name of an audio file inside this smart item's folder (e.g. siren.mp3), looped while the alarm is triggered. Leave empty for no sound.
   * @param hoverText - Text shown when the player points at the alarm.
   * @param clickToTrigger - If true, clicking the alarm triggers it. If false, clicking plays the animation and sound once without triggering the alarm.
   */
  constructor(
    public src: string, // DO NOT REMOVE
    public entity: Entity, // DO NOT REMOVE
    public activateAnimation: string = 'activate',
    public idleAnimation: string = 'deactivate',
    public sound: string = 'siren.mp3',
    public hoverText: string = 'Poke',
    public clickToTrigger: boolean = true,
  ) {}

  /**
   * Start function - called when the script is initialized
   */
  start() {
    if (!Animator.getOrNull(this.entity)) {
      Animator.create(this.entity, { states: [] });
    }

    // The triggered state lives in a synced component, so every player hears the
    // alarm start and stop. Each client reacts to the change inside update().
    const { States } = getComponents(engine);
    if (!States.getOrNull(this.entity)) {
      States.create(this.entity, {
        id: this.entity,
        value: ['Silent', 'Triggered'],
        defaultValue: 'Silent',
        currentValue: 'Silent',
      });
    }
    this.lastState = States.get(this.entity).currentValue ?? 'Silent';

    if (this.idleAnimation) {
      this.playAnimation(this.idleAnimation, false);
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
      () => {
        if (this.clickToTrigger) {
          this.trigger();
        } else {
          // A poke: play the animation and sound once without changing the state
          this.playAnimation(this.activateAnimation, false);
          this.playSound(false);
        }
      },
    );
  }

  /**
   * Update function - called every frame
   * @param dt - Delta time since last frame (in seconds)
   */
  update(_dt: number) {
    const states = getComponents(engine).States.getOrNull(this.entity);
    if (!states) return;
    const current = states.currentValue ?? 'Silent';
    if (current === this.lastState) return;
    this.lastState = current;

    if (current === 'Triggered') {
      this.playAnimation(this.activateAnimation, true);
      this.playSound(true);
    } else {
      this.stopSound();
      if (this.idleAnimation) {
        this.playAnimation(this.idleAnimation, false);
      } else {
        Animator.stopAllAnimations(this.entity);
      }
    }
  }

  /**
   * Triggers the alarm, looping its animation and sound until disarmed
   * @action
   */
  public trigger() {
    this.setState('Triggered');
  }

  /**
   * Disarms the alarm, stopping its animation and sound
   * @action
   */
  public disarm() {
    this.setState('Silent');
  }

  private setState(next: string) {
    const { States } = getComponents(engine);
    const current = States.getOrNull(this.entity);
    if (!current || current.currentValue === next) return;
    const states = States.getMutable(this.entity);
    states.previousValue = states.currentValue;
    states.currentValue = next;
  }

  private playAnimation(clip: string, loop: boolean) {
    if (!clip) return;
    const animator = Animator.getMutable(this.entity);
    if (!animator.states.some((s: { clip: string }) => s.clip === clip)) {
      animator.states = [...animator.states, { clip, playing: false, loop: false }];
    }
    Animator.stopAllAnimations(this.entity);
    const state = Animator.getClip(this.entity, clip);
    state.playing = true;
    state.loop = loop;
    state.shouldReset = true;
  }

  private playSound(loop: boolean) {
    if (!this.sound) return;
    AudioSource.createOrReplace(this.entity, {
      audioClipUrl: `${this.src}/${this.sound}`,
      playing: true,
      loop,
    });
  }

  private stopSound() {
    const audio = AudioSource.getMutableOrNull(this.entity);
    if (audio) audio.playing = false;
  }
}
