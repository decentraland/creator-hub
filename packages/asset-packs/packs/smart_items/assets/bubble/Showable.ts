import type { Entity } from '@dcl/sdk/ecs';
import { VisibilityComponent } from '@dcl/sdk/ecs';

export class Showable {
  /**
   * An item that can be shown and hidden by other smart items, for example a button
   * or a trigger area.
   */
  constructor(
    public src: string, // DO NOT REMOVE
    public entity: Entity, // DO NOT REMOVE
  ) {}

  /**
   * Start function - called when the script is initialized
   */
  start() {}

  /**
   * Shows the item
   * @action
   */
  public show() {
    this.setVisible(true);
  }

  /**
   * Hides the item
   * @action
   */
  public hide() {
    this.setVisible(false);
  }

  /**
   * Shows the item if it is hidden, or hides it if it is shown
   * @action
   */
  public toggle() {
    const visibility = VisibilityComponent.getOrNull(this.entity);
    this.setVisible(!(visibility?.visible ?? true));
  }

  private setVisible(visible: boolean) {
    const visibility = VisibilityComponent.getMutableOrNull(this.entity);
    if (visibility) visibility.visible = visible;
    else VisibilityComponent.create(this.entity, { visible });
  }
}
