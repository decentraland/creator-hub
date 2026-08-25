import type { Entity } from '@dcl/sdk/ecs';
import { InputAction, pointerEventsSystem } from '@dcl/sdk/ecs';
import { openExternalUrl } from '~system/RestrictedActions';

export class SocialLink {
  /**
   * A clickable item that opens a link in the player's browser.
   *
   * @param url - URL opened when the item is clicked.
   * @param hoverText - Text shown when the player points at the item.
   */
  constructor(
    public src: string, // DO NOT REMOVE
    public entity: Entity, // DO NOT REMOVE
    public url: string = 'https://decentraland.org',
    public hoverText: string = 'Website Link',
  ) {}

  /**
   * Start function - called when the script is initialized
   */
  start() {
    pointerEventsSystem.onPointerDown(
      {
        entity: this.entity,
        opts: {
          button: InputAction.IA_POINTER,
          hoverText: this.hoverText,
          maxDistance: 10,
        },
      },
      () => this.openLink(),
    );
  }

  /**
   * Opens the link in the player's browser
   * @action
   */
  public openLink() {
    if (this.url) {
      void openExternalUrl({ url: this.url });
    }
  }
}
