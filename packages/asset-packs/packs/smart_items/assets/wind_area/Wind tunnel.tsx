import {
  ColliderLayer,
  engine,
  Entity,
  Physics,
  TriggerArea,
  triggerAreaEventsSystem,
  Transform,
  GltfContainer,
} from '@dcl/sdk/ecs';
import { Vector3 } from '@dcl/sdk/math';

export class WindTunnel {
  /**
   * Properties
   * Define class fields you want to reuse across methods.
   * Example usage: this.myVariable
   */
  // private myVariable: boolean = true

  /**
   * Constructor / Inputs
   * Parameters declared here appear in the Script component UI in Creator Hub.
   * Supported types: Entity, String, Number, Boolean, ActionCallback.
   *
   * Note: After editing this file, click the refresh icon in the Script component UI
   * to see updated inputs.
   *
   * The `src` and `entity` fields in the constructor are required by internal references.
   */
  constructor(
    public src: string, // DO NOT REMOVE
    public entity: Entity, // DO NOT REMOVE
    public strength: number = 80,
    public debug: boolean,
    // Add your custom inputs below
  ) {
    this.debug = debug;
    this.strength = strength;
  }

  /**
   * start()
   * Called once when the script is initialized.
   */
  start() {
    TriggerArea.setBox(this.entity, ColliderLayer.CL_PLAYER);

    triggerAreaEventsSystem.onTriggerEnter(this.entity, () => {
      const direction = Vector3.rotate(
        Vector3.create(0, 1, 0),
        Transform.get(this.entity).rotation,
      );
      Physics.applyForceToPlayer(this.entity, direction, this.strength);
    });

    triggerAreaEventsSystem.onTriggerExit(this.entity, () => {
      Physics.removeForceFromPlayer(this.entity);
    });

    if (this.debug) {
      GltfContainer.create(this.entity, { src: this.src + '/wind-tunnel-area.glb' });
    }
  }
}
