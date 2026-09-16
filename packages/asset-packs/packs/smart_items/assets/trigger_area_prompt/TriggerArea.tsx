import { ColliderLayer, engine, Entity, TriggerArea, triggerAreaEventsSystem } from '@dcl/sdk/ecs';

// The generic Trigger Area detector. It owns the SDK trigger callbacks (the SDK keeps only
// ONE per (entity, event), so a reaction must NOT touch triggerAreaEventsSystem itself) and
// exposes enter/leave/occupancy as instance methods. A reaction script on the SAME entity
// finds this instance via getAllScriptInstances(entity) from '~sdk/script-utils' and subscribes
// through onEnter/onExit/isInside — so the shared detector never changes per trigger, and each
// reaction stays its own file.
export class TriggerAreaDetector {
  private inside = new Set<Entity>();
  private enterFns: Array<(who: Entity) => void> = [];
  private exitFns: Array<(who: Entity) => void> = [];

  /**
   * Constructor / Inputs
   * Parameters declared here appear in the Script component UI in Creator Hub.
   * The `src` and `entity` fields in the constructor are required by internal references.
   */
  constructor(
    public src: string, // DO NOT REMOVE
    public entity: Entity, // DO NOT REMOVE
    public onlyMe: boolean = false,
    public shape: 'box' | 'sphere' = 'box',
  ) {
    this.onlyMe = onlyMe;
    this.shape = shape;
  }

  /**
   * start()
   * Turns this entity into an invisible trigger volume sized by its Transform
   * (resize it with the scale gizmo) and starts tracking who is inside.
   */
  start() {
    if (this.shape === 'sphere') {
      TriggerArea.setSphere(this.entity, ColliderLayer.CL_PLAYER);
    } else {
      TriggerArea.setBox(this.entity, ColliderLayer.CL_PLAYER);
    }
    triggerAreaEventsSystem.onTriggerEnter(this.entity, event => this.seen(event.trigger?.entity));
    triggerAreaEventsSystem.onTriggerStay(this.entity, event => this.seen(event.trigger?.entity));
    triggerAreaEventsSystem.onTriggerExit(this.entity, event => this.gone(event.trigger?.entity));
  }

  /** Run `fn` when a player enters. Anyone already inside is replayed immediately. */
  onEnter(fn: (who: Entity) => void) {
    this.enterFns.push(fn);
    for (const who of this.inside) fn(who);
  }

  /** Run `fn` when a player leaves. */
  onExit(fn: (who: Entity) => void) {
    this.exitFns.push(fn);
  }

  /** True while at least one accepted player is inside — use for "while inside" logic. */
  isInside() {
    return this.inside.size > 0;
  }

  // The result carries a raw entity id (0 is the scene root, never an avatar).
  // onlyMe reacts to this player only; otherwise to any player's avatar the client is
  // simulating (local + remote). The CL_PLAYER mask already keeps non-player colliders out.
  private accepts(raw?: number): Entity | undefined {
    if (raw === undefined || raw === 0) return undefined;
    const who = raw as Entity;
    if (this.onlyMe && who !== engine.PlayerEntity) return undefined;
    return who;
  }

  private seen(raw?: number) {
    const who = this.accepts(raw);
    if (who === undefined || this.inside.has(who)) return;
    this.inside.add(who);
    for (const fn of this.enterFns) fn(who);
  }

  private gone(raw?: number) {
    if (raw === undefined || raw === 0) return;
    const who = raw as Entity;
    if (!this.inside.delete(who)) return;
    for (const fn of this.exitFns) fn(who);
  }
}
