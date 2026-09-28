import type { Entity } from '@dcl/sdk/ecs';
import { LightSource } from '@dcl/sdk/ecs';

export class Lights {
  /**
   * A light source that can be turned on and off by other smart items, for example
   * a button or a lever.
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
   * Turns the light on
   * @action
   */
  public turnOn() {
    this.setActive(true);
  }

  /**
   * Turns the light off
   * @action
   */
  public turnOff() {
    this.setActive(false);
  }

  /**
   * Turns the light off if it is on, or on if it is off
   * @action
   */
  public toggle() {
    const light = LightSource.getOrNull(this.entity);
    this.setActive(!(light?.active ?? true));
  }

  private setActive(active: boolean) {
    const light = LightSource.getMutableOrNull(this.entity);
    if (light) light.active = active;
  }
}
