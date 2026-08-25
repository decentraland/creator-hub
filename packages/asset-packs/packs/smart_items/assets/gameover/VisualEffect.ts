import type { Entity } from '@dcl/sdk/ecs';
import { Animator, AudioSource, VisibilityComponent } from '@dcl/sdk/ecs';

export class VisualEffect {
  private hideTimer: number = 0;
  private delayedSoundTimer: number = 0;

  /**
   * A visual effect that stays invisible until triggered, then shows itself, playing its
   * animation and sound. Trigger it from another smart item, for example a trigger area or a button.
   *
   * @param animation - Name of the animation clip in the effect's model that plays when the effect is triggered.
   * @param loop - If true, the animation keeps playing until the effect is hidden.
   * @param sound - Name of an audio file inside this smart item's folder (e.g. sound.mp3), played when the effect is triggered. Leave empty for no sound.
   * @param hideAfter - Seconds until the effect hides itself again after being triggered. Use 0 to keep it visible until Hide is called.
   * @param delayedSound - Name of a second audio file inside this smart item's folder, played some seconds after the effect is triggered (e.g. a firework explosion after the launch). Leave empty for no sound.
   * @param delayedSoundDelay - Seconds after the trigger before the delayed sound plays.
   */
  constructor(
    public src: string, // DO NOT REMOVE
    public entity: Entity, // DO NOT REMOVE
    public animation: string = 'Play',
    public loop: boolean = false,
    public sound: string = '',
    public hideAfter: number = 0,
    public delayedSound: string = '',
    public delayedSoundDelay: number = 0,
  ) {}

  /**
   * Start function - called when the script is initialized
   */
  start() {
    if (this.animation) {
      // The Creator Hub already creates the Animator with the model's clips; only
      // fill it in if missing, and apply the configured loop to the trigger clip
      const animator = Animator.getMutableOrNull(this.entity);
      if (animator) {
        const state = animator.states.find(s => s.clip === this.animation);
        if (state) {
          state.loop = this.loop;
        } else {
          animator.states.push({ clip: this.animation, playing: false, loop: this.loop });
        }
      } else {
        Animator.create(this.entity, {
          states: [{ clip: this.animation, playing: false, loop: this.loop }],
        });
      }
    }
    if (!VisibilityComponent.getOrNull(this.entity)) {
      VisibilityComponent.create(this.entity, { visible: false });
    }
  }

  /**
   * Update function - called every frame
   * @param dt - Delta time since last frame (in seconds)
   */
  update(dt: number) {
    if (this.delayedSoundTimer > 0) {
      this.delayedSoundTimer -= dt;
      if (this.delayedSoundTimer <= 0 && this.delayedSound) {
        AudioSource.playSound(this.entity, `${this.src}/${this.delayedSound}`);
      }
    }
    if (this.hideTimer > 0) {
      this.hideTimer -= dt;
      if (this.hideTimer <= 0) {
        this.hide();
      }
    }
  }

  /**
   * Shows the effect, playing its animation and sound
   * @action
   */
  public trigger() {
    VisibilityComponent.getMutable(this.entity).visible = true;
    if (this.animation) {
      Animator.playSingleAnimation(this.entity, this.animation);
    }
    if (this.sound) {
      // playSound resets currentTime so the sound replays from the start
      AudioSource.playSound(this.entity, `${this.src}/${this.sound}`);
    }
    if (this.delayedSound) {
      if (this.delayedSoundDelay > 0) {
        this.delayedSoundTimer = this.delayedSoundDelay;
      } else {
        AudioSource.playSound(this.entity, `${this.src}/${this.delayedSound}`);
      }
    }
    if (this.hideAfter > 0) {
      this.hideTimer = this.hideAfter;
    }
  }

  /**
   * Hides the effect and stops its animation
   * @action
   */
  public hide() {
    VisibilityComponent.getMutable(this.entity).visible = false;
    if (this.animation) {
      Animator.stopAllAnimations(this.entity);
    }
    this.hideTimer = 0;
    this.delayedSoundTimer = 0;
  }
}
