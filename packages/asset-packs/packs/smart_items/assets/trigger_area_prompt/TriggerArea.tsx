import { ColliderLayer, engine, Entity, TriggerArea, triggerAreaEventsSystem } from '@dcl/sdk/ecs';

// The collision layer the area listens on, by dropdown value. Both player options mask on
// CL_PLAYER (which lets in every avatar, local + remote); "my player" additionally narrows to
// the local avatar in accepts(). The rest map straight to their collider layer.
const LAYER_MASK: Record<string, ColliderLayer> = {
  'my player': ColliderLayer.CL_PLAYER,
  'all players': ColliderLayer.CL_PLAYER,
  'any collider': ColliderLayer.CL_PHYSICS,
  clickable: ColliderLayer.CL_POINTER,
  'custom 1': ColliderLayer.CL_CUSTOM1,
  'custom 2': ColliderLayer.CL_CUSTOM2,
  'custom 3': ColliderLayer.CL_CUSTOM3,
};

// The generic Trigger Area detector. It owns the SDK trigger callbacks (the SDK keeps only
// ONE per (entity, event), so a reaction must NOT touch triggerAreaEventsSystem itself) and
// fans out enter/exit to any number of reactions. A reaction script on the SAME entity finds
// this instance via getAllScriptInstances(entity) from '~sdk/script-utils' and subscribes with
// onEvent(name, fn) — so the shared detector never changes per trigger, and each reaction stays
// its own file. The @event tags below are read by the editor to offer per-event reaction prompts.
/**
 * @event enter
 * @event exit
 */
export class TriggerAreaDetector {
  private inside = new Set<Entity>();
  private subs: Record<string, Array<(who?: Entity) => void>> = { enter: [], exit: [] };

  /**
   * Constructor / Inputs
   * Parameters declared here appear in the Script component UI in Creator Hub.
   * The `src` and `entity` fields in the constructor are required by internal references.
   */
  constructor(
    public src: string, // DO NOT REMOVE
    public entity: Entity, // DO NOT REMOVE
    public activatedBy:
      | 'my player'
      | 'all players'
      | 'any collider'
      | 'clickable'
      | 'custom 1'
      | 'custom 2'
      | 'custom 3' = 'my player',
    public shape: 'box' | 'sphere' = 'box',
  ) {
    this.activatedBy = activatedBy;
    this.shape = shape;
  }

  /**
   * start()
   * Turns this entity into an invisible trigger volume sized by its Transform
   * (resize it with the scale gizmo) and starts tracking what is inside.
   */
  start() {
    const mask = LAYER_MASK[this.activatedBy] ?? ColliderLayer.CL_PLAYER;
    if (this.shape === 'sphere') {
      TriggerArea.setSphere(this.entity, mask);
    } else {
      TriggerArea.setBox(this.entity, mask);
    }
    triggerAreaEventsSystem.onTriggerEnter(this.entity, event => this.seen(event.trigger?.entity));
    triggerAreaEventsSystem.onTriggerStay(this.entity, event => this.seen(event.trigger?.entity));
    triggerAreaEventsSystem.onTriggerExit(this.entity, event => this.gone(event.trigger?.entity));
  }

  /**
   * Subscribe a reaction to 'enter' or 'exit'. Anything already inside replays as 'enter' so a
   * late subscriber still fires. The callback receives the avatar/entity that moved.
   */
  onEvent(name: string, fn: (who?: Entity) => void) {
    (this.subs[name] ??= []).push(fn);
    if (name === 'enter') for (const who of this.inside) fn(who);
  }

  /** True while at least one accepted entity is inside — use for "while inside" logic. */
  isInside() {
    return this.inside.size > 0;
  }

  private emit(name: string, who: Entity) {
    for (const fn of this.subs[name] ?? []) fn(who);
  }

  // The result carries a raw entity id (0 is the scene root, never an avatar). "my player" is
  // the only layer that narrows to the local avatar; every other layer accepts whatever the
  // collision mask let through.
  private accepts(raw?: number): Entity | undefined {
    if (raw === undefined || raw === 0) return undefined;
    const who = raw as Entity;
    if (this.activatedBy === 'my player' && who !== engine.PlayerEntity) return undefined;
    return who;
  }

  private seen(raw?: number) {
    const who = this.accepts(raw);
    if (who === undefined || this.inside.has(who)) return;
    this.inside.add(who);
    this.emit('enter', who);
  }

  private gone(raw?: number) {
    if (raw === undefined || raw === 0) return;
    const who = raw as Entity;
    if (!this.inside.delete(who)) return;
    this.emit('exit', who);
  }
}
