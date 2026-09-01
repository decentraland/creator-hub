import type { Entity } from '@dcl/sdk/ecs';
import {
  engine,
  Font,
  InputAction,
  Name,
  PointerFilterMode,
  pointerEventsSystem,
  TextAlignMode,
  Transform,
  UiText,
  UiTransform,
  YGUnit,
} from '@dcl/sdk/ecs';
import { Vector3 } from '@dcl/sdk/math';
import { getComponents } from '@dcl/asset-packs/dist/definitions';
import { getWorldPosition, getWorldRotation } from '@dcl/asset-packs/dist/helpers';
import { movePlayerTo, triggerEmote } from '~system/RestrictedActions';

const SITTING_EMOTES = ['sittingChair1', 'sittingChair2'];
const STAND_UP_DISTANCE = 1.5;
const MESSAGE_SECONDS = 2;

export class Seat {
  private seats: Entity[] = [];
  private sittingOn: Entity | null = null;
  private messageEntity: Entity | null = null;
  private messageTimer: number = 0;

  /**
   * A seat that players can click to sit on. Bigger seats have more than one sit
   * spot. Each spot is marked as taken while someone sits on it, and is freed only
   * when the player who sat down stands up and walks away.
   *
   * @param hoverText - Text shown when the player points at the seat.
   * @param takenMessage - Message shown when trying to sit while every spot is taken. Leave empty for no message.
   */
  constructor(
    public src: string, // DO NOT REMOVE
    public entity: Entity, // DO NOT REMOVE
    public hoverText: string = 'Sit Here',
    public takenMessage: string = 'Seat is taken',
  ) {}

  /**
   * Start function - called when the script is initialized
   */
  start() {
    // Sit spots are the invisible child entities named "Sit Spot", which mark where
    // the avatar is placed when sitting. A standalone sit spot has no children: the
    // entity itself is the spot.
    for (const [child, transform] of engine.getEntitiesWith(Transform)) {
      if (transform.parent !== this.entity) continue;
      const name = Name.getOrNull(child);
      if (name && name.value.startsWith('Sit Spot')) {
        this.seats.push(child);
      }
    }
    if (this.seats.length === 0) {
      this.seats = [this.entity];
    }

    // Each spot's Free/Taken state lives in a synced component, so every player
    // sees the same availability.
    const { States } = getComponents(engine);
    for (const seat of this.seats) {
      if (!States.getOrNull(seat)) {
        States.create(seat, {
          id: seat,
          value: ['Free', 'Taken'],
          defaultValue: 'Free',
          currentValue: 'Free',
        });
      }
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
      () => this.sit(),
    );
  }

  /**
   * Update function - called every frame
   * @param dt - Delta time since last frame (in seconds)
   */
  update(dt: number) {
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) {
        this.hideMessage();
      }
    }

    // Only the client of the player who sat down frees the spot, once that player
    // stands up and moves away. Other players coming and going must not free it.
    if (this.sittingOn !== null) {
      const player = Transform.getOrNull(engine.PlayerEntity);
      if (
        player &&
        Vector3.distance(player.position, getWorldPosition(this.sittingOn)) > STAND_UP_DISTANCE
      ) {
        this.setSeatState(this.sittingOn, 'Free');
        this.sittingOn = null;
      }
    }
  }

  /**
   * Sits the player on the nearest free sit spot, or shows the taken message if every spot is taken
   * @action
   */
  public sit() {
    const player = Transform.getOrNull(engine.PlayerEntity);
    if (!player) return;

    if (this.sittingOn !== null) {
      this.setSeatState(this.sittingOn, 'Free');
      this.sittingOn = null;
    }

    const { States } = getComponents(engine);
    let nearest: Entity | null = null;
    let nearestDistance = Infinity;
    for (const seat of this.seats) {
      if (States.getOrNull(seat)?.currentValue === 'Taken') continue;
      const distance = Vector3.distance(player.position, getWorldPosition(seat));
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = seat;
      }
    }
    if (nearest === null) {
      this.showMessage();
      return;
    }

    // The avatar must be moved before the sitting emote plays: in the reverse
    // order the movement can cancel the emote and leave the avatar standing.
    const position = getWorldPosition(nearest);
    const forward = Vector3.rotate(Vector3.Forward(), getWorldRotation(nearest));
    void movePlayerTo({
      newRelativePosition: position,
      avatarTarget: Vector3.add(position, forward),
    });
    this.setSeatState(nearest, 'Taken');
    const emote = SITTING_EMOTES[Math.floor(Math.random() * SITTING_EMOTES.length)];
    void triggerEmote({ predefinedEmote: emote });
    this.sittingOn = nearest;
  }

  /**
   * Marks every sit spot of this seat as free
   * @action
   */
  public markAsFree() {
    for (const seat of this.seats) {
      this.setSeatState(seat, 'Free');
    }
    this.sittingOn = null;
  }

  private setSeatState(seat: Entity, next: string) {
    const { States } = getComponents(engine);
    const current = States.getOrNull(seat);
    if (!current || current.currentValue === next) return;
    const states = States.getMutable(seat);
    states.previousValue = states.currentValue;
    states.currentValue = next;
  }

  private showMessage() {
    if (!this.takenMessage) return;
    this.hideMessage();
    const textEntity = engine.addEntity();
    const uiTransform = UiTransform.create(textEntity);
    uiTransform.parent = this.entity;
    uiTransform.height = 100;
    uiTransform.width = 100;
    uiTransform.heightUnit = YGUnit.YGU_PERCENT;
    uiTransform.widthUnit = YGUnit.YGU_PERCENT;
    uiTransform.maxHeight = 100;
    uiTransform.maxWidth = 100;
    uiTransform.maxHeightUnit = YGUnit.YGU_PERCENT;
    uiTransform.maxWidthUnit = YGUnit.YGU_PERCENT;
    uiTransform.pointerFilter = PointerFilterMode.PFM_NONE;
    UiText.create(textEntity, {
      value: this.takenMessage,
      font: Font.F_SANS_SERIF,
      fontSize: 40,
      textAlign: TextAlignMode.TAM_BOTTOM_CENTER,
    });
    this.messageEntity = textEntity;
    this.messageTimer = MESSAGE_SECONDS;
  }

  private hideMessage() {
    if (this.messageEntity !== null) {
      engine.removeEntity(this.messageEntity);
      this.messageEntity = null;
    }
    this.messageTimer = 0;
  }
}
