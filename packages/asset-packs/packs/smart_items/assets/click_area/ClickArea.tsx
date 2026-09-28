import type { Entity } from '@dcl/sdk/ecs';
import { InputAction, pointerEventsSystem } from '@dcl/sdk/ecs';

/**
 * An invisible clickable area. It does nothing on its own — describe a reaction (or wire an
 * action) for when a player clicks it. Resize it with the scale gizmo.
 *
 * @event click
 * @param hoverText - Text shown when the player points at the area.
 * @param inputButton - Input that clicks it: 0 = pointer/click, 1 = E key, 2 = F key.
 */
export class ClickArea {
  // Reactions subscribe here (via getAllScriptInstances + onEvent); the click fans out to them.
  private subs: Record<string, Array<(arg?: Entity) => void>> = {};

  constructor(
    public src: string, // DO NOT REMOVE
    public entity: Entity, // DO NOT REMOVE
    public hoverText: string = 'Click',
    public inputButton: number = 0,
  ) {}

  start() {
    pointerEventsSystem.onPointerDown(
      {
        entity: this.entity,
        opts: {
          button: this.inputButton as InputAction,
          hoverText: this.hoverText,
          maxDistance: 10,
        },
      },
      () => {
        for (const fn of this.subs.click ?? []) fn();
      },
    );
  }

  /** Subscribe a reaction to this item's events (currently 'click'). */
  onEvent(name: string, fn: (arg?: Entity) => void) {
    (this.subs[name] ??= []).push(fn);
  }
}
