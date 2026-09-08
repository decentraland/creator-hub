import type { Entity } from '@dcl/sdk/ecs';
import { AudioSource, engine, Name, Transform, VisibilityComponent } from '@dcl/sdk/ecs';
import { getComponents } from '@dcl/asset-packs/dist/definitions';
import type { ActionCallback } from '~sdk/script-utils';

export class Sign {
  private lastState: string = '';
  private openEntity: Entity | null = null;
  private closedEntity: Entity | null = null;

  /**
   * A sign that swaps between showing its Open and Closed sides. Flip it from other
   * smart items, for example a button or a lever. Its state is shared with other
   * players, so everyone sees the same side.
   *
   * @param sound - Name of an audio file inside this smart item's folder, played whenever the sign flips. Leave empty for no sound.
   * @param onOpen - Action triggered every time the sign flips to Open.
   * @param onClose - Action triggered every time the sign flips to Closed.
   */
  constructor(
    public src: string, // DO NOT REMOVE
    public entity: Entity, // DO NOT REMOVE
    public sound: string = 'NeonTube.mp3',
    public onOpen?: ActionCallback,
    public onClose?: ActionCallback,
  ) {}

  /**
   * Start function - called when the script is initialized
   */
  start() {
    // The two sides are the child entities named "Open" and "Closed"
    for (const [child, transform] of engine.getEntitiesWith(Transform)) {
      if (transform.parent !== this.entity) continue;
      const name = Name.getOrNull(child)?.value;
      if (name === 'Open') this.openEntity = child;
      if (name === 'Closed') this.closedEntity = child;
    }

    // The state lives in a synced component so every player sees the same side.
    // Each client reacts to the change inside update().
    const { States } = getComponents(engine);
    if (!States.getOrNull(this.entity)) {
      States.create(this.entity, {
        id: this.entity,
        value: ['Open', 'Closed'],
        defaultValue: 'Open',
        currentValue: 'Open',
      });
    }
    this.lastState = States.get(this.entity).currentValue ?? 'Open';
    this.applyState(this.lastState, false);
  }

  /**
   * Update function - called every frame
   * @param dt - Delta time since last frame (in seconds)
   */
  update(_dt: number) {
    const states = getComponents(engine).States.getOrNull(this.entity);
    if (!states) return;
    const current = states.currentValue ?? 'Open';
    if (current === this.lastState) return;
    this.lastState = current;
    this.applyState(current, true);
  }

  /**
   * Flips the sign to Open
   * @action
   */
  public open() {
    this.setState('Open');
  }

  /**
   * Flips the sign to Closed
   * @action
   */
  public close() {
    this.setState('Closed');
  }

  /**
   * Flips the sign to Closed if it shows Open, or to Open if it shows Closed
   * @action
   */
  public toggle() {
    this.setState(this.lastState === 'Open' ? 'Closed' : 'Open');
  }

  private applyState(state: string, flipped: boolean) {
    const isOpen = state === 'Open';
    this.setVisible(this.openEntity, isOpen);
    this.setVisible(this.closedEntity, !isOpen);
    if (!flipped) return;
    if (this.sound) {
      AudioSource.playSound(this.entity, `${this.src}/${this.sound}`);
    }
    if (isOpen) {
      if (this.onOpen) this.onOpen();
    } else {
      if (this.onClose) this.onClose();
    }
  }

  private setState(next: string) {
    const { States } = getComponents(engine);
    const current = States.getOrNull(this.entity);
    if (!current || current.currentValue === next) return;
    const states = States.getMutable(this.entity);
    states.previousValue = states.currentValue;
    states.currentValue = next;
  }

  private setVisible(target: Entity | null, visible: boolean) {
    if (target === null) return;
    const visibility = VisibilityComponent.getMutableOrNull(target);
    if (visibility) visibility.visible = visible;
    else VisibilityComponent.create(target, { visible });
  }
}
