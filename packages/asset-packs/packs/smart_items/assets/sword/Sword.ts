import {
  AvatarAttach,
  engine,
  InputAction,
  inputSystem,
  PointerEventType,
  pointerEventsSystem,
} from '@dcl/sdk/ecs';
import type { Entity } from '@dcl/sdk/ecs';
import { Vector3 } from '@dcl/sdk/math';
import { getTriggerEvents } from '@dcl/asset-packs/dist/events';
import { getExplorerComponents } from '@dcl/asset-packs/dist/components';
import {
  getWorldPosition,
  getPlayerPosition,
  getEntityParent,
} from '@dcl/asset-packs/dist/helpers';
import { TriggerType } from '@dcl/asset-packs/dist/definitions';
import { damageTargets } from '@dcl/asset-packs/dist/triggers';
import { triggerSceneEmote } from '~system/RestrictedActions';

// Deal damage to every registered target within `radius`, `hits` times each, honoring who to hit.
// `damageTargets` is the shared registry every target (Robot, Barrel, Wooden Fence, Health Bar) adds
// itself to, so this reaches the same targets as every other combat item. The sword is attached to
// the player, so damage originates from the player's position.
function dealDamage(
  from: Entity,
  radius: number,
  hits: number,
  target: 'all' | 'player' | 'non_player',
) {
  const { AvatarAttach: AvatarAttachComponent } = getExplorerComponents(engine);
  const origin = AvatarAttachComponent.has(from) ? getPlayerPosition() : getWorldPosition(from);
  for (const entity of damageTargets) {
    if (entity === from) continue; // never damage ourselves
    if (target !== 'all') {
      let root = entity;
      for (let parent = getEntityParent(root); parent; parent = getEntityParent(root))
        root = parent;
      const isPlayer = root === engine.PlayerEntity || root === engine.CameraEntity;
      if (target === 'player' && !isPlayer) continue;
      if (target === 'non_player' && isPlayer) continue;
    }
    if (Vector3.distance(origin, getWorldPosition(entity)) <= Math.max(radius, 0)) {
      for (let i = 0; i < Math.max(hits, 1); i++)
        getTriggerEvents(entity).emit(TriggerType.ON_DAMAGE);
    }
  }
}

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
    dealDamage(this.entity, this.radius, this.damagePoints, this.damageTarget);
    this.state = 'cooling';
    this.timer = this.cooldown;
  }
}
