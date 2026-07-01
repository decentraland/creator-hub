import type { ComponentDefinition, Entity, TransformType } from '@dcl/ecs';
import { CrdtMessageType, Engine } from '@dcl/ecs';
import type { IEngine } from '@dcl/ecs';
import * as components from '@dcl/ecs/dist/components';
import { Vector3 as DclVector3 } from '@dcl/ecs-math';
import type { Vector3 } from '@dcl/ecs-math';

import { createOperations } from '../../sdk/operations';
import { createEditorComponents } from '../../sdk/components';

const ROOT = 0 as Entity;

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
    onChangeFunction: (entity, op, component) => this.#processEcsChange(entity, op, component),
  });

  readonly Transform = components.Transform(this.engine);

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

  #processEcsChange(entity: Entity, op: CrdtMessageType, component?: ComponentDefinition<unknown>) {
    if (op === CrdtMessageType.DELETE_ENTITY) {
      this.#worldPositions.delete(entity);
      return;
    }
    if (!component || component.componentId !== this.Transform.componentId) return;
    // A transform changed — recompute world positions for the whole tracked set,
    // since a parent move shifts its descendants. The tracked set is small in the
    // spike; the wasm path will replace this with positions mirrored from Bevy.
    this.#recomputeWorldPositions();
  }

  #recomputeWorldPositions() {
    this.#worldPositions.clear();
    for (const [entity] of this.engine.getEntitiesWith(this.Transform)) {
      if (entity === ROOT) continue;
      this.#worldPositions.set(entity, this.#resolveWorldPosition(entity));
    }
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
