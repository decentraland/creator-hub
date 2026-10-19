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

// The pressable disc of floor_pressure_button.glb is ~2 m wide with its top at 0.3 m. The area
// covers the disc and the avatar standing on it. It is a child of the button, so scaling the
// button in the editor scales the area with it.
const AREA_SIZE = { x: 2, y: 1, z: 2 };
const AREA_CENTER = { x: 0, y: 0.7, z: 0 };

export class FloorButton {
  // Avatars standing on the button, as this client sees them
  private inside = new Set<Entity>();
  // Whether this client currently shows the button pressed
  private shown = false;
  // The press()/release() hold in 'my player' mode (in 'all players' mode it is the synced States)
  private localHold = false;
  // Reactions subscribe here (via getAllScriptInstances + onEvent); refresh() fans out.
  private subs: Record<string, Array<(arg?: Entity) => void>> = {};

  /**
   * A floor button that presses down while a player stands on it and pops back up when
   * they step off. Wire it to other smart items with On Press / On Release, or react to
   * its press and release events.
   *
   * With 'all players' the button is shared: it stays down while anyone stands on it, every
   * player sees it, and its actions run on the client of the player who pressed or released
   * it, not on every client.
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

  /**
   * Start function - called when the script is initialized
   */
  start() {
    // Animation and sound stay local: every client derives them from who it sees on the
    // button plus the synced hold, so nothing here needs to be sent over the network.
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

    // The press()/release() hold of a shared button is shared too, like a door's state.
    if (this.shared()) {
      const { States } = getComponents(engine);
      if (!States.getOrNull(this.entity)) {
        States.create(this.entity, {
          id: this.entity,
          value: ['Released', 'Pressed'],
          defaultValue: 'Released',
          currentValue: 'Released',
        });
      }
    }
    if (this.held()) {
      this.shown = true;
      if (this.pressAnimation) Animator.playSingleAnimation(this.entity, this.pressAnimation);
    }

    const area = engine.addEntity();
    Transform.create(area, { parent: this.entity, position: AREA_CENTER, scale: AREA_SIZE });
    TriggerArea.setBox(area, ColliderLayer.CL_PLAYER);
    triggerAreaEventsSystem.onTriggerEnter(area, event => this.seen(event.trigger?.entity));
    // Stay only backs up a missed enter for this player. The SDK keeps replaying stay for a
    // remote avatar that left without an exit event, and its id can later belong to another
    // player anywhere in the scene, so remote avatars count from their enter event only.
    triggerAreaEventsSystem.onTriggerStay(area, event => {
      if (event.trigger?.entity === engine.PlayerEntity) this.seen(engine.PlayerEntity);
    });
    triggerAreaEventsSystem.onTriggerExit(area, event => this.gone(event.trigger?.entity));
  }

  /**
   * Update function - catches changes this client did not cause
   * @param _dt - Delta time since last frame (in seconds)
   */
  update(_dt: number) {
    // A player who disconnects or teleports away while on the button may never send an
    // exit event, so drop avatars that are no longer in the scene.
    let pruned = false;
    for (const who of this.inside) {
      if (who === engine.PlayerEntity || PlayerIdentityData.has(who)) continue;
      this.inside.delete(who);
      pruned = true;
    }
    // Nobody stepped off on this client, so if that released the button one client still has
    // to run On Release: the player with the lowest address, the same choice on every client.
    // Otherwise this picks up a hold set or cleared by another player, which only moves the
    // button here: that player's client ran the actions.
    this.refresh(pruned && this.lowestAddress());
  }

  /**
   * Holds the button down, as if a player stood on it, until Release is called
   * @action
   */
  public press() {
    this.hold(true);
  }

  /**
   * Lets go of a press made with Press. The button stays down while a player is standing on it.
   * @action
   */
  public release() {
    this.hold(false);
  }

  /** Subscribe a reaction to this item's events ('press' / 'release'). */
  onEvent(name: string, fn: (arg?: Entity) => void) {
    (this.subs[name] ??= []).push(fn);
  }

  private shared() {
    return this.activatedBy !== 'my player';
  }

  private held() {
    if (!this.shared()) return this.localHold;
    return getComponents(engine).States.getOrNull(this.entity)?.currentValue === 'Pressed';
  }

  private hold(on: boolean) {
    if (this.shared()) {
      const { States } = getComponents(engine);
      const next = on ? 'Pressed' : 'Released';
      const current = States.getOrNull(this.entity);
      if (current && current.currentValue !== next) {
        const states = States.getMutable(this.entity);
        states.previousValue = states.currentValue;
        states.currentValue = next;
      }
    } else {
      this.localHold = on;
    }
    this.refresh(true);
  }

  // Show the button as it now is. Only the client that caused the change (`byMe`) runs the
  // actions and events, so they don't multiply with the number of players in the scene.
  private refresh(byMe: boolean) {
    const pressed = this.inside.size > 0 || this.held();
    if (pressed === this.shown) return;
    this.shown = pressed;
    this.feedback(pressed ? this.pressAnimation : this.releaseAnimation);
    if (!byMe) return;
    const action = pressed ? this.onPress : this.onRelease;
    if (action) action();
    for (const fn of this.subs[pressed ? 'press' : 'release'] ?? []) fn();
  }

  // The trigger result carries a raw entity id. Count this player, and in a shared button any
  // other player in the scene; skip ids that are not a known avatar (0 is the scene root, and
  // the explorer reports an avatar it cannot resolve with an id outside the player range).
  private avatar(raw?: number): Entity | undefined {
    if (raw === undefined || raw === 0) return undefined;
    const who = raw as Entity;
    if (who === engine.PlayerEntity) return who;
    return this.shared() && PlayerIdentityData.has(who) ? who : undefined;
  }

  private seen(raw?: number) {
    const who = this.avatar(raw);
    if (who === undefined || this.inside.has(who)) return;
    this.inside.add(who);
    this.refresh(who === engine.PlayerEntity);
  }

  private gone(raw?: number) {
    if (raw === undefined) return;
    const who = raw as Entity;
    if (!this.inside.delete(who)) return;
    this.refresh(who === engine.PlayerEntity);
  }

  private lowestAddress() {
    const mine = PlayerIdentityData.getOrNull(engine.PlayerEntity)?.address.toLowerCase();
    if (!mine) return false;
    for (const [, player] of engine.getEntitiesWith(PlayerIdentityData)) {
      if (player.address.toLowerCase() < mine) return false;
    }
    return true;
  }

  private feedback(clip: string) {
    if (clip) Animator.playSingleAnimation(this.entity, clip);
    if (this.sound) AudioSource.playSound(this.entity, `${this.src}/${this.sound}`);
  }
}
