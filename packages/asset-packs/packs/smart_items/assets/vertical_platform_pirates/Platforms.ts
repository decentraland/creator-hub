import type { Entity, PBTween } from '@dcl/sdk/ecs';
import {
  AudioSource,
  EasingFunction,
  Transform,
  Tween,
  TweenLoop,
  TweenSequence,
  TweenState,
  TweenStateStatus,
  tweenSystem,
} from '@dcl/sdk/ecs';
import { Vector3 } from '@dcl/sdk/math';
import type { ActionCallback } from '~sdk/script-utils';

export class Platforms {
  private startPosition: Vector3 = Vector3.Zero();
  private endPosition: Vector3 = Vector3.Zero();
  private movingToEnd: boolean = true;
  private pendingTween: PBTween | null = null;

  /**
   * A platform that moves back and forth between its start position and an end position.
   * Players can jump on it to reach places.
   *
   * @param offsetX - Meters to travel along the X axis, relative to the platform's start position.
   * @param offsetY - Meters to travel along the Y axis, relative to the platform's start position.
   * @param offsetZ - Meters to travel along the Z axis, relative to the platform's start position.
   * @param duration - Seconds it takes to travel from one end to the other.
   * @param autoStart - If true, the platform starts moving when the scene loads.
   * @param loop - If true, the platform keeps moving back and forth. If false, it stops at either end until Go to Start or Go to End is called.
   * @param sound - Name of an audio file inside this smart item's folder (e.g. sound.mp3), played whenever the platform starts moving. Leave empty for no sound.
   * @param onReachEnd - Action triggered every time the platform reaches the end position.
   * @param onReachStart - Action triggered every time the platform reaches the start position.
   */
  constructor(
    public src: string, // DO NOT REMOVE
    public entity: Entity, // DO NOT REMOVE
    public offsetX: number = 4,
    public offsetY: number = 0,
    public offsetZ: number = 0,
    public duration: number = 5,
    public autoStart: boolean = true,
    public loop: boolean = true,
    public sound: string = '',
    public onReachEnd?: ActionCallback,
    public onReachStart?: ActionCallback,
  ) {}

  /**
   * Start function - called when the script is initialized
   */
  start() {
    const { position } = Transform.get(this.entity);
    this.startPosition = Vector3.clone(position);
    this.endPosition = Vector3.add(
      this.startPosition,
      Vector3.create(this.offsetX, this.offsetY, this.offsetZ),
    );

    if (this.sound) {
      AudioSource.createOrReplace(this.entity, {
        audioClipUrl: `${this.src}/${this.sound}`,
        playing: false,
      });
    }

    // The engine drives the back-and-forth motion: a yoyo TweenSequence reverses
    // the tween on each completion, so the script never has to rewrite the Tween
    // while looping (rewriting it races against the renderer's completion state).
    Tween.create(
      this.entity,
      this.tweenBetween(this.startPosition, this.endPosition, this.autoStart),
    );
    if (this.loop) {
      TweenSequence.create(this.entity, { sequence: [], loop: TweenLoop.TL_YOYO });
    }
    if (this.autoStart) {
      this.playSound();
    }
  }

  /**
   * Update function - called every frame
   * @param dt - Delta time since last frame (in seconds)
   */
  update(_dt: number) {
    // A tween replaced in the same frame its predecessor was deleted inherits the old
    // completion state, so Go to Start / Go to End defer the new tween by one tick.
    if (this.pendingTween) {
      Tween.createOrReplace(this.entity, this.pendingTween);
      this.pendingTween = null;
      return;
    }

    // Same completion check the Triggers runtime uses for On Tween End
    if (
      Tween.getOrNull(this.entity) &&
      TweenState.getOrNull(this.entity)?.state === TweenStateStatus.TS_COMPLETED &&
      tweenSystem.tweenCompleted(this.entity)
    ) {
      if (this.movingToEnd) {
        this.movingToEnd = false;
        if (this.onReachEnd) this.onReachEnd();
      } else {
        this.movingToEnd = true;
        if (this.onReachStart) this.onReachStart();
      }
      if (this.loop) {
        // The engine's yoyo sequence is already sending the platform back
        this.playSound();
      }
    }
  }

  /**
   * Moves the platform towards the end position
   * @action
   */
  public goToEnd() {
    this.travelTo(this.endPosition, true);
  }

  /**
   * Moves the platform back towards the start position
   * @action
   */
  public goToStart() {
    this.travelTo(this.startPosition, false);
  }

  private travelTo(target: Vector3, toEnd: boolean) {
    this.movingToEnd = toEnd;
    const from = Vector3.clone(Transform.get(this.entity).position);
    Tween.deleteFrom(this.entity);
    this.pendingTween = this.tweenBetween(from, target, true);
    if (this.loop) {
      // After reaching the target, resume looping over the full start-end span
      const back = toEnd
        ? this.tweenBetween(this.endPosition, this.startPosition, true)
        : this.tweenBetween(this.startPosition, this.endPosition, true);
      TweenSequence.createOrReplace(this.entity, { sequence: [back], loop: TweenLoop.TL_YOYO });
    }
    this.playSound();
  }

  private tweenBetween(start: Vector3, end: Vector3, playing: boolean): PBTween {
    return {
      mode: Tween.Mode.Move({ start: Vector3.clone(start), end: Vector3.clone(end) }),
      duration: this.duration * 1000,
      easingFunction: EasingFunction.EF_LINEAR,
      playing,
    };
  }

  private playSound() {
    if (!this.sound) return;
    const audio = AudioSource.getMutableOrNull(this.entity);
    if (!audio) return;
    audio.playing = false;
    audio.playing = true;
  }
}
