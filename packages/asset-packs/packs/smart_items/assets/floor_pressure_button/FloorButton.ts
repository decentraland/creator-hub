import type { Entity } from '@dcl/sdk/ecs';
import {
  Animator,
  AudioSource,
  ColliderLayer,
  engine,
  Transform,
  TriggerArea,
  triggerAreaEventsSystem,
} from '@dcl/sdk/ecs';
import type { ActionCallback } from '~sdk/script-utils';

// The pressable disc of floor_pressure_button.glb is ~2 m wide with its top at 0.3 m. The area
// covers the disc and the avatar standing on it. It is a child of the button, so scaling the
// button in the editor scales the area with it.
const AREA_SIZE = { x: 2, y: 1, z: 2 };
const AREA_CENTER = { x: 0, y: 0.7, z: 0 };

export class FloorButton {
  private inside = new Set<Entity>();
  private pressed = false;
  // Reactions subscribe here (via getAllScriptInstances + onEvent); press()/release() fan out.
  private subs: Record<string, Array<(arg?: Entity) => void>> = {};

  /**
   * A floor button that presses down while a player stands on it and pops back up when
   * they step off. Wire it to other smart items with On Press / On Release, or react to
   * its press and release events.
   *
   * @event press
   * @event release
   * @param activatedBy - Who presses the button: only this player, or any player in the scene.
   * @param onPress - Action triggered when the first player steps onto the button.
   * @param onRelease - Action triggered when the last player steps off the button.
   * @param sound - Name of an audio file inside this smart item's folder (e.g. sound.mp3), played on press and release. Leave empty for no sound.
   * @param pressAnimation - Name of the animation clip in the button's model that plays when it is pressed.
   * @param releaseAnimation - Name of the animation clip in the button's model that plays when it is released.
   */
  constructor(
    public src: string, // DO NOT REMOVE
    public entity: Entity, // DO NOT REMOVE
    public activatedBy: 'my player' | 'all players' = 'my player',
    public onPress?: ActionCallback,
    public onRelease?: ActionCallback,
    public sound: string = 'sound.mp3',
    public pressAnimation: string = 'press',
    public releaseAnimation: string = 'unpress',
  ) {}

  /**
   * Start function - called when the script is initialized
   */
  start() {
    Animator.createOrReplace(this.entity, {
      states: [this.pressAnimation, this.releaseAnimation]
        .filter(Boolean)
        .map(clip => ({ clip, playing: false, loop: false })),
    });
    if (this.sound) {
      AudioSource.createOrReplace(this.entity, {
        audioClipUrl: `${this.src}/${this.sound}`,
        playing: false,
      });
    }

    const area = engine.addEntity();
    Transform.create(area, { parent: this.entity, position: AREA_CENTER, scale: AREA_SIZE });
    TriggerArea.setBox(area, ColliderLayer.CL_PLAYER);
    triggerAreaEventsSystem.onTriggerEnter(area, event => this.seen(event.trigger?.entity));
    triggerAreaEventsSystem.onTriggerStay(area, event => this.seen(event.trigger?.entity));
    triggerAreaEventsSystem.onTriggerExit(area, event => this.gone(event.trigger?.entity));
  }

  /**
   * Presses the button, as if a player stepped on it
   * @action
   */
  public press() {
    if (this.pressed) return;
    this.pressed = true;
    this.feedback(this.pressAnimation);
    if (this.onPress) this.onPress();
    for (const fn of this.subs.press ?? []) fn();
  }

  /**
   * Releases the button, as if the last player stepped off it
   * @action
   */
  public release() {
    if (!this.pressed) return;
    this.pressed = false;
    this.feedback(this.releaseAnimation);
    if (this.onRelease) this.onRelease();
    for (const fn of this.subs.release ?? []) fn();
  }

  /** Subscribe a reaction to this item's events ('press' / 'release'). */
  onEvent(name: string, fn: (arg?: Entity) => void) {
    (this.subs[name] ??= []).push(fn);
  }

  // The trigger result carries a raw entity id; 0 is the scene root, never an avatar.
  private seen(raw?: number) {
    if (raw === undefined || raw === 0) return;
    const who = raw as Entity;
    if (this.activatedBy === 'my player' && who !== engine.PlayerEntity) return;
    if (this.inside.has(who)) return;
    this.inside.add(who);
    if (this.inside.size === 1) this.press();
  }

  private gone(raw?: number) {
    if (raw === undefined || raw === 0) return;
    if (!this.inside.delete(raw as Entity)) return;
    if (this.inside.size === 0) this.release();
  }

  private feedback(clip: string) {
    if (clip) Animator.playSingleAnimation(this.entity, clip);
    if (this.sound) AudioSource.playSound(this.entity, `${this.src}/${this.sound}`);
  }
}
