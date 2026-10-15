import type { Entity } from '@dcl/sdk/ecs';
import { Animator } from '@dcl/sdk/ecs';

export class AnimationPlayer {
  /**
   * Plays or stops one of the model's animations when another smart item asks it to.
   * The model stays visible either way.
   *
   * @param animation - Name of the animation clip in the model to play.
   * @param loop - If true, the animation repeats until it is stopped.
   * @param playOnStart - If true, the animation starts playing as soon as the scene loads.
   */
  constructor(
    public src: string, // DO NOT REMOVE
    public entity: Entity, // DO NOT REMOVE
    public animation: string = 'Play',
    public loop: boolean = true,
    public playOnStart: boolean = false,
  ) {}

  /**
   * Start function - called when the script is initialized
   */
  start() {
    const animator = Animator.getMutableOrNull(this.entity);
    if (!animator) {
      Animator.create(this.entity, {
        states: [{ clip: this.animation, playing: false, loop: this.loop }],
      });
    } else {
      const state = animator.states.find(s => s.clip === this.animation);
      if (state) state.loop = this.loop;
      else animator.states.push({ clip: this.animation, playing: false, loop: this.loop });
    }
    if (this.playOnStart) this.play();
  }

  /**
   * Update function - called every frame
   * @param _dt - Delta time since last frame (in seconds)
   */
  update(_dt: number) {}

  /**
   * Plays the animation
   * @action
   */
  public play() {
    Animator.playSingleAnimation(this.entity, this.animation);
  }

  /**
   * Stops the animation
   * @action
   */
  public stop() {
    Animator.stopAllAnimations(this.entity);
  }
}
