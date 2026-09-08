import type { Entity } from '@dcl/sdk/ecs';
import { InputAction, pointerEventsSystem } from '@dcl/sdk/ecs';
import { changeRealm, teleportTo } from '~system/RestrictedActions';

export class Teleport {
  /**
   * A clickable portal that teleports players to another place in Decentraland: either
   * scene coordinates in Genesis City, or a world.
   *
   * @param world - Name of the world to teleport to (e.g. myname.dcl.eth). Leave empty to teleport to coordinates instead.
   * @param x - Scene X coordinate to teleport to when no world is set.
   * @param y - Scene Y coordinate to teleport to when no world is set.
   * @param hoverText - Text shown when the player points at the item.
   */
  constructor(
    public src: string, // DO NOT REMOVE
    public entity: Entity, // DO NOT REMOVE
    public world: string = '',
    public x: number = 0,
    public y: number = 0,
    public hoverText: string = 'Teleport',
  ) {}

  /**
   * Start function - called when the script is initialized
   */
  start() {
    pointerEventsSystem.onPointerDown(
      {
        entity: this.entity,
        opts: {
          button: InputAction.IA_PRIMARY,
          hoverText: this.hoverText,
          maxDistance: 10,
        },
      },
      () => this.teleport(),
    );
  }

  /**
   * Teleports the player to the configured world or coordinates
   * @action
   */
  public teleport() {
    if (this.world) {
      void changeRealm({ realm: this.world });
    } else {
      void teleportTo({ worldCoordinates: { x: this.x, y: this.y } });
    }
  }
}
