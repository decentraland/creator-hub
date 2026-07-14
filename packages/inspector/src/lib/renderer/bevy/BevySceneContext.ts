import type { ComponentDefinition, Entity, TransformType } from '@dcl/ecs';
import { CrdtMessageType, Engine } from '@dcl/ecs';
import type { IEngine } from '@dcl/ecs';
import * as components from '@dcl/ecs/dist/components';
import { Quaternion as DclQuaternion, Vector3 as DclVector3 } from '@dcl/ecs-math';
import type { Quaternion, Vector3 } from '@dcl/ecs-math';

import { createOperations } from '../../sdk/operations';
import { createEditorComponents } from '../../sdk/components';

const ROOT = 0 as Entity;

/** A raw ECS-change subscriber (see {@link BevySceneContext.onChange}). */
export type EcsChangeHandler = (
  entity: Entity,
  op: CrdtMessageType,
  component?: ComponentDefinition<unknown>,
  value?: unknown,
) => void;

/**
 * The Bevy counterpart of Babylon's `SceneContext` / Three's `ThreeSceneContext`
 * — the CRDT-subscriber core, engine-side but renderer-agnostic.
 *
 * At this spike stage there is **no engine yet**: the real bevy-explorer wasm
 * will run out-of-process in an iframe (see docs/authoring-a-renderer.md and the
 * feasibility study). What this context does today is the half that does *not*
 * need the wasm — own an `@dcl/ecs` engine, subscribe to its CRDT changes, and
 * maintain the minimal world-space state the {@link IRenderer} sync getters must
 * answer (entity world positions). It deliberately keeps no scene graph.
 *
 * This mirrors `ThreeSceneContext`'s architecture on purpose: it is the same
 * boundary the Babylon and Three renderers use, which is what proves the
 * contract is engine-agnostic rather than Babylon- or Three-shaped. When the
 * iframe transport is wired, the engine here becomes the source the inspector's
 * CRDT stream feeds, and the world positions get mirrored back from the wasm
 * instead of computed locally.
 *
 * Scope (spike): Transform only (position/rotation/scale/parent), tracked as
 * local world positions so `getEntityWorldPositions` returns real data under the
 * conformance suite. GltfContainer/MeshRenderer and everything else are
 * intentionally unhandled here — there is no renderer to project them into yet.
 */
export class BevySceneContext {
  readonly engine: IEngine = Engine({
    onChangeFunction: (entity, op, component, value) =>
      this.#processEcsChange(entity, op, component, value),
  });

  readonly Transform = components.Transform(this.engine);

  // Register the core visual SDK components on this engine so their CRDT stream
  // (DataLayer → this engine, via connectCrdtToEngine) DECODES — otherwise an
  // unregistered component arrives undecodable and its onChange never reports the
  // real `componentName`, so the forward-edit bridge can't recognise it and skips
  // it. That's what left a dropped model's GltfContainer unforwarded (rendered as
  // a placeholder cube). The set matches forward-edits' ENGINE_COMPONENT_NAMES.
  readonly #registeredComponents = [
    this.Transform,
    components.GltfContainer(this.engine),
    components.MeshRenderer(this.engine),
    components.MeshCollider(this.engine),
    components.Material(this.engine),
    components.VisibilityComponent(this.engine),
    components.Billboard(this.engine),
    components.TextShape(this.engine),
  ];

  /**
   * The engine components forwarded to the wasm engine, keyed by `@dcl/ecs`
   * componentName — so the forward-edit bridge can look one up (e.g. to re-send an
   * entity's current components after instantiating it). Transform + the core
   * visual set registered above.
   */
  getForwardableComponent(componentName: string): ComponentDefinition<unknown> | null {
    return this.#registeredComponents.find(c => c.componentName === componentName) ?? null;
  }

  // The Name component (core-schema::Name) — a CUSTOM (non-engine) component that
  // round-trips scene↔renderer. forward-edits uses it to INSTANTIATE a new entity
  // in the engine scene (`/new_entity`, which requires a custom component; engine
  // components like Transform flow one-way and can't anchor an entity). Registered
  // here so it decodes off the CRDT stream and exposes its id + schema.
  readonly Name = components.Name(this.engine);

  // Engine-bound operations + editor components, so the reverse-channel handler
  // can apply picks/edits against this renderer's engine just like Babylon and
  // Three do — the shared handler needs this exact surface.
  readonly operations = createOperations(this.engine);
  readonly editorComponents = createEditorComponents(this.engine);

  // Local world-space position per entity. A pure CRDT projection: no scene
  // graph, just the transform hierarchy resolved to world space so the viewport
  // sync getter can answer without a renderer present.
  #worldPositions = new Map<Entity, Vector3>();
  #frameHandlers = new Set<() => void>();
  // Subscribers to raw ECS changes (the forward edit bridge translates these to
  // engine console commands). `@dcl/ecs` exposes only the single construction-time
  // onChangeFunction — which this context owns — so anything else that needs the
  // change stream subscribes here rather than trying to hook the engine directly.
  #changeHandlers = new Set<EcsChangeHandler>();

  #processEcsChange(
    entity: Entity,
    op: CrdtMessageType,
    component?: ComponentDefinition<unknown>,
    value?: unknown,
  ) {
    if (op === CrdtMessageType.DELETE_ENTITY) {
      this.#worldPositions.delete(entity);
    } else if (component && component.componentId === this.Transform.componentId) {
      // A transform changed — recompute world positions for the whole tracked
      // set, since a parent move shifts its descendants. Small in the spike; the
      // wasm path will replace this with positions mirrored from Bevy.
      this.#recomputeWorldPositions();
    }
    // Fan out to change subscribers (forward edit bridge). Iterate a copy so a
    // handler that unsubscribes mid-iteration doesn't disturb the walk.
    for (const h of [...this.#changeHandlers]) h(entity, op, component, value);
  }

  /** Subscribe to raw ECS changes. Returns an unsubscribe fn. */
  onChange(handler: EcsChangeHandler): () => void {
    this.#changeHandlers.add(handler);
    return () => this.#changeHandlers.delete(handler);
  }

  #recomputeWorldPositions() {
    this.#worldPositions.clear();
    for (const [entity] of this.engine.getEntitiesWith(this.Transform)) {
      if (entity === ROOT) continue;
      this.#worldPositions.set(entity, this.#resolveWorldPosition(entity));
    }
  }

  /**
   * Convert a scene-WORLD position into an entity's LOCAL (parent-relative)
   * position — i.e. subtract the parent's accumulated world position. The gizmo
   * agent works in world space (it's given world anchors and reports world
   * positions), but Transform.position is stored relative to the parent; without
   * this a NESTED child would be written its world position as if local and jump
   * by the parent's offset. Root-parented entities are unaffected (parent world
   * position is 0). Translation only — parent rotation/scale of the frame is not
   * applied (matches the spike-level world-position model in #resolveWorldPosition).
   */
  worldToLocalPosition(entity: Entity, world: { x: number; y: number; z: number }): Vector3 {
    const t = this.Transform.getOrNull(entity) as TransformType | null;
    const parent = t?.parent as Entity | undefined;
    if (parent === undefined || parent === ROOT) {
      return DclVector3.create(world.x, world.y, world.z);
    }
    const parentWorld = this.#resolveWorldPosition(parent);
    return DclVector3.create(
      world.x - parentWorld.x,
      world.y - parentWorld.y,
      world.z - parentWorld.z,
    );
  }

  /** Resolve an entity's world position by walking its Transform.parent chain. */
  #resolveWorldPosition(entity: Entity): Vector3 {
    let x = 0;
    let y = 0;
    let z = 0;
    let current: Entity | undefined = entity;
    // Bound the walk so a malformed cyclic parent chain can't spin forever.
    let guard = 0;
    while (current !== undefined && current !== ROOT && guard++ < 1024) {
      const t = this.Transform.getOrNull(current) as TransformType | null;
      if (!t) break;
      x += t.position.x;
      y += t.position.y;
      z += t.position.z;
      current = t.parent as Entity | undefined;
    }
    return DclVector3.create(x, y, z);
  }

  /**
   * An entity's world rotation, composed down the Transform.parent chain
   * (world = parent-world ⊗ local) — the rotation analogue of
   * {@link BevySceneContext.#resolveWorldPosition}, with the same spike-level
   * fidelity (parent scale is ignored). Null when the entity has no Transform.
   * The selection bridge sends this to the agent so the scale gizmo can align
   * its handles to the entity's rotation.
   */
  getEntityWorldRotation(entity: Entity): Quaternion | null {
    // Collect local rotations from the entity up to the root…
    const locals: Quaternion[] = [];
    let current: Entity | undefined = entity;
    // Bound the walk so a malformed cyclic parent chain can't spin forever.
    let guard = 0;
    while (current !== undefined && current !== ROOT && guard++ < 1024) {
      const t = this.Transform.getOrNull(current) as TransformType | null;
      if (!t) break;
      locals.push(t.rotation);
      current = t.parent as Entity | undefined;
    }
    if (locals.length === 0) return null;
    // …then compose top-down: world = R(topmost ancestor) ⊗ … ⊗ R(entity).
    let world = DclQuaternion.Identity();
    for (let i = locals.length - 1; i >= 0; i--) {
      const q = locals[i];
      world = DclQuaternion.multiply(world, DclQuaternion.create(q.x, q.y, q.z, q.w));
    }
    return world;
  }

  /**
   * World positions for the requested entities. Entities with no tracked
   * transform are omitted — the {@link IRenderer} contract says a missing id
   * means "not drawable this frame".
   */
  getEntityWorldPositions(entities: Entity[]): Map<Entity, Vector3> {
    const out = new Map<Entity, Vector3>();
    for (const entity of entities) {
      const pos = this.#worldPositions.get(entity);
      if (pos) out.set(entity, pos);
    }
    return out;
  }

  /** Subscribe to a render tick. In the spike a tick is driven by `tick()`. */
  onFrame(cb: () => void): () => void {
    this.#frameHandlers.add(cb);
    return () => this.#frameHandlers.delete(cb);
  }

  /** Signal a frame to onFrame subscribers (the wasm render loop drives this later). */
  tick(): void {
    // Iterate a copy: a handler may unsubscribe (mutating the Set) mid-iteration.
    for (const h of [...this.#frameHandlers]) h();
  }

  dispose(): void {
    this.#worldPositions.clear();
    this.#frameHandlers.clear();
  }
}
