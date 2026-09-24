import {
  AvatarAttach,
  engine,
  InputAction,
  inputSystem,
  PointerEventType,
  pointerEventsSystem,
} from '@dcl/sdk/ecs';
import type { Entity } from '@dcl/sdk/ecs';
import { dealDamageInRadius } from '@dcl/asset-packs/dist/combat';
import type { ProximityLayer } from '@dcl/asset-packs/dist/definitions';
import { triggerSceneEmote } from '~system/RestrictedActions';

type SwordState = 'idle' | 'picking' | 'ready' | 'cooling';

export class Sword {
  private state: SwordState = 'idle';
  private timer = 0;

  /**
   * A sword the player picks up and swings. Click it to pick it up (it attaches to the player's
   * hand); then press the primary button to swing, dealing damage to enemies in front of you. Use
   * with the Robot, and destructibles like the Barrel and Wooden Fence.
   *
   * @param hoverText - Text shown when pointing at the sword.
   * @param radius - How far the swing's damage reaches from the player.
   * @param damagePoints - How much damage each swing deals.
   * @param damageTarget - Who the swing damages.
   * @param cooldown - Seconds between swings.
   * @param attackEmote - Emote file (.glb) played when swinging (e.g. sword_attack_emote.glb). Empty for none.
   */
  constructor(
    public src: string, // DO NOT REMOVE
    public entity: Entity, // DO NOT REMOVE
    public hoverText: string = 'Pick up',
    public radius: number = 3,
    public damagePoints: number = 10,
    public damageTarget: 'all' | 'player' | 'non_player' = 'non_player',
    public cooldown: number = 0.5,
    public attackEmote: string = 'sword_attack_emote.glb',
  ) {}

  start() {
    pointerEventsSystem.onPointerDown(
      {
        entity: this.entity,
        opts: { button: InputAction.IA_PRIMARY, hoverText: this.hoverText, maxDistance: 10 },
      },
      () => this.pickUp(),
    );
  }

  update(dt: number) {
    // Short delay after pick-up so the same press doesn't immediately swing.
    if (this.state === 'picking') {
      this.timer -= dt;
      if (this.timer <= 0) this.state = 'ready';
      return;
    }
    if (this.state === 'cooling') {
      this.timer -= dt;
      if (this.timer <= 0) this.state = 'ready';
      return;
    }
    if (
      this.state === 'ready' &&
      inputSystem.isTriggered(InputAction.IA_PRIMARY, PointerEventType.PET_DOWN)
    ) {
      this.attack();
    }
  }

  /**
   * Picks up the sword and attaches it to the player's hand.
   * @action
   */
  public pickUp() {
    if (this.state !== 'idle') return;
    AvatarAttach.createOrReplace(this.entity, { anchorPointId: 3 });
    this.state = 'picking';
    this.timer = 0.1;
  }

  /**
   * Swings the sword, damaging targets in range of the player, then starts the cooldown.
   * @action
   */
  public attack() {
    if (this.state !== 'ready') return;
    if (this.attackEmote) {
      void triggerSceneEmote({ src: `${this.src}/${this.attackEmote}`, loop: false });
    }
    dealDamageInRadius(engine, this.entity, {
      radius: this.radius,
      hits: this.damagePoints,
      layer: this.damageTarget as ProximityLayer,
    });
    this.state = 'cooling';
    this.timer = this.cooldown;
  }
}
