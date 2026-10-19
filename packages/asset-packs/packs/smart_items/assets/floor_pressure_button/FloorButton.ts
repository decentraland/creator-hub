import type { Entity } from '@dcl/sdk/ecs';
import {
  Animator,
  AudioSource,
  ColliderLayer,
  engine,
  PlayerIdentityData,
  Transform,
  TriggerArea,
  triggerAreaEventsSystem,
} from '@dcl/sdk/ecs';
import { getComponents } from '@dcl/asset-packs/dist/definitions';
import type { ActionCallback } from '~sdk/script-utils';

const AREA_SIZE = { x: 2, y: 1, z: 2 };
const AREA_CENTER = { x: 0, y: 0.7, z: 0 };
const SETTLE_SECONDS = 1;

type Value = 'Released' | 'Pressed' | 'Held';
const VALUES: Value[] = ['Released', 'Pressed', 'Held'];

export class FloorButton {
  private inside = new Set<Entity>();
  private unidentified = new Map<Entity, number>();
  private shown = false;
  private localValue: Value = 'Released';
  private leftPressed = false;
  private disagreeFor = 0;
  private subs: Record<string, Array<(arg?: Entity) => void>> = {};

  /**
   * A floor button that presses down while a player stands on it and pops back up when
   * they step off. Wire it to other smart items with On Press / On Release, or react to
   * its press and release events.
   *
   * With 'all players' the button is shared: it stays down while anyone stands on it, every
   * player sees it, and its actions run once, on the client of the player who pressed or
   * released it. When players step on or off within a moment of each other, an action can
   * run twice, or up to a second late.
   * With 'my player' every player has their own button: it reacts only to them, and only
   * they see it move and run its actions.
   *
   * @event press
   * @event release
   * @param activatedBy - Who presses the button: 'all players' shares it between everyone; 'my player' reacts only to you, and only you see it.
   * @param onPress - Action triggered when the first player steps onto the button.
   * @param onRelease - Action triggered when the last player steps off the button.
   * @param sound - Name of an audio file inside this smart item's folder (e.g. sound.mp3), played on press and release. Leave empty for no sound.
   * @param pressAnimation - Name of the animation clip in the button's model that plays when it is pressed.
   * @param releaseAnimation - Name of the animation clip in the button's model that plays when it is released.
   */
  constructor(
    public src: string, // DO NOT REMOVE
    public entity: Entity, // DO NOT REMOVE
    public activatedBy: 'all players' | 'my player' = 'all players',
    public onPress?: ActionCallback,
    public onRelease?: ActionCallback,
    public sound: string = 'sound.mp3',
    public pressAnimation: string = 'press',
    public releaseAnimation: string = 'unpress',
  ) {}

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

    if (this.shared()) {
      const { States } = getComponents(engine);
      if (!States.getOrNull(this.entity)) {
        States.create(this.entity, {
          id: this.entity,
          value: VALUES,
          defaultValue: 'Released',
          currentValue: 'Released',
        });
      }
    }
    if (this.value() !== 'Released') {
      this.shown = true;
      if (this.pressAnimation) Animator.playSingleAnimation(this.entity, this.pressAnimation);
    }

    const area = engine.addEntity();
    Transform.create(area, { parent: this.entity, position: AREA_CENTER, scale: AREA_SIZE });
    TriggerArea.setBox(area, ColliderLayer.CL_PLAYER);
    triggerAreaEventsSystem.onTriggerEnter(area, event => this.seen(event.trigger?.entity));
    triggerAreaEventsSystem.onTriggerStay(area, event => {
      if (event.trigger?.entity === engine.PlayerEntity) this.seen(engine.PlayerEntity);
    });
    triggerAreaEventsSystem.onTriggerExit(area, event => this.gone(event.trigger?.entity));
  }

  update(dt: number) {
    for (const [who, waited] of this.unidentified) {
      if (PlayerIdentityData.has(who)) {
        this.unidentified.delete(who);
        this.seen(who);
      } else if (waited > SETTLE_SECONDS) {
        this.unidentified.delete(who);
      } else {
        this.unidentified.set(who, waited + dt);
      }
    }
    let pruned = false;
    for (const who of this.inside) {
      if (who === engine.PlayerEntity || PlayerIdentityData.has(who)) continue;
      this.inside.delete(who);
      pruned = true;
    }
    if (pruned && this.lowestAddress()) this.settle();
    this.reconcile(dt);
    this.show();
  }

  /**
   * Holds the button down, as if a player stood on it, until Release is called
   * @action
   */
  public press() {
    this.change('Held');
  }

  /**
   * Lets go of a press made with Press. The button stays down while a player is standing on it.
   * @action
   */
  public release() {
    if (this.value() === 'Held') this.change(this.occupied() ? 'Pressed' : 'Released');
  }

  /** Subscribe a reaction to this item's events ('press' / 'release'). */
  onEvent(name: string, fn: (arg?: Entity) => void) {
    (this.subs[name] ??= []).push(fn);
  }

  private shared() {
    return this.activatedBy !== 'my player';
  }

  private occupied() {
    return this.inside.size > 0;
  }

  private value(): Value {
    if (!this.shared()) return this.localValue;
    const current = getComponents(engine).States.getOrNull(this.entity)?.currentValue;
    return (current as Value | undefined) ?? 'Released';
  }

  private settle() {
    if (this.value() !== 'Held') this.change(this.occupied() ? 'Pressed' : 'Released');
  }

  private change(next: Value) {
    const previous = this.value();
    if (previous === next) return;
    if (this.shared()) {
      const states = getComponents(engine).States.getMutableOrNull(this.entity);
      if (!states) return;
      states.previousValue = states.currentValue;
      states.currentValue = next;
    } else {
      this.localValue = next;
    }
    const pressed = next !== 'Released';
    if (pressed === (previous !== 'Released')) return;
    const action = pressed ? this.onPress : this.onRelease;
    if (action) action();
    for (const fn of this.subs[pressed ? 'press' : 'release'] ?? []) fn();
  }

  private reconcile(dt: number) {
    const value = this.value();
    if (value === 'Released') this.leftPressed = false;
    const agrees = value === 'Held' || this.occupied() === (value === 'Pressed');
    const involved = this.leftPressed || this.inside.has(engine.PlayerEntity);
    this.disagreeFor = agrees || !involved ? 0 : this.disagreeFor + dt;
    if (this.disagreeFor >= SETTLE_SECONDS) this.settle();
  }

  private show() {
    const pressed = this.value() !== 'Released' || this.occupied();
    if (pressed === this.shown) return;
    this.shown = pressed;
    const clip = pressed ? this.pressAnimation : this.releaseAnimation;
    if (clip) Animator.playSingleAnimation(this.entity, clip);
    if (this.sound) AudioSource.playSound(this.entity, `${this.src}/${this.sound}`);
  }

  private seen(raw?: number) {
    if (raw === undefined || raw === 0) return;
    const who = raw as Entity;
    if (this.inside.has(who)) return;
    if (who !== engine.PlayerEntity) {
      if (!this.shared()) return;
      if (!PlayerIdentityData.has(who)) {
        if (!this.unidentified.has(who)) this.unidentified.set(who, 0);
        return;
      }
    }
    this.inside.add(who);
    if (who === engine.PlayerEntity) this.settle();
  }

  private gone(raw?: number) {
    if (raw === undefined) return;
    const who = raw as Entity;
    this.unidentified.delete(who);
    if (!this.inside.delete(who) || who !== engine.PlayerEntity) return;
    this.settle();
    this.leftPressed = this.value() !== 'Released';
  }

  private lowestAddress() {
    const mine = PlayerIdentityData.getOrNull(engine.PlayerEntity)?.address.toLowerCase();
    if (!mine) return false;
    for (const [, player] of engine.getEntitiesWith(PlayerIdentityData)) {
      if (player.address.toLowerCase() < mine) return false;
    }
    return true;
  }
}
