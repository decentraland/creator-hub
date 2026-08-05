import type { Entity, IEntityContainer } from '@dcl/ecs';
import { createEntityContainer } from '@dcl/ecs/dist/engine/entity';

/**
 * Entity-id floor for editor-authored entity allocation (#1468).
 *
 * In the Bevy editor the inspected scene runs in a SEPARATE engine and creates its
 * OWN entities from code (`engine.addEntity()`), seeded from a BUILD-TIME constant
 * (`DCL_MAX_COMPOSITE_ENTITY`). The editor, meanwhile, allocates new authored
 * entities from the inspector engine's counter (the composite's max + 1) WITHOUT
 * rebuilding — so a freshly added editor entity can be handed the SAME id a runtime
 * code entity already holds. In Bevy that collision is destructive: the forward
 * bridge's `/new_entity --ids N` clashes with the code entity and the editor's
 * components overwrite it (the reporter's barrel), and undo then orphans its
 * children to 0,0,0.
 *
 * Fix: the active out-of-process renderer publishes the highest entity id currently
 * live in its engine (authored + code) here; the inspector engine's entity allocator
 * then skips past it, so a new authored entity is always allocated ABOVE every entity
 * the running scene currently has — no overlap, live or after reload/preview (which
 * re-derive the code floor from the now-larger composite). Only the Bevy renderer
 * sets it; Babylon (in-process, single id space) leaves it 0, so the container below
 * is a transparent pass-through there.
 */

let floor = 0;

/** The current floor: new editor entities are allocated with a number > this. */
export function getEntityIdFloor(): number {
  return floor;
}

/** Raise the floor to the running renderer's max live entity id (monotonic within a
 * scene session). Never lowers it — a transient smaller reading can't reintroduce a
 * collision. */
export function setEntityIdFloor(maxLiveEntityId: number): void {
  if (maxLiveEntityId > floor) floor = maxLiveEntityId;
}

/** Clear the floor when the renderer is torn down (scene close / switch), so the next
 * scene — or a Babylon scene — starts from a clean slate. */
export function resetEntityIdFloor(): void {
  floor = 0;
}

/**
 * Parse the engine's `/scene_entities` reply into the highest live entity id. The
 * reply is one entity per line — numeric ids plus non-numeric aliases (root, player,
 * camera) or `(no entities)`; take the max of the numeric lines (0 if none). The
 * renderer feeds this to {@link setEntityIdFloor}.
 */
export function parseMaxLiveEntityId(sceneEntitiesReply: string): number {
  let max = 0;
  for (const line of sceneEntitiesReply.split('\n')) {
    const n = Number(line.trim());
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

// An entity id packs a 16-bit number (low) and a 16-bit version (high); the FLOOR is
// compared against the number, since a code entity and an editor entity collide by
// number regardless of version.
const ENTITY_NUMBER_MASK = 0xffff;

/**
 * Wrap `@dcl/ecs`'s entity container so freshly generated entities are pushed past
 * {@link getEntityIdFloor}. Delegates everything else to the stock container (versions,
 * removal, reuse) so behavior is identical when the floor is 0 (Babylon / no renderer).
 */
export function createFloorEntityContainer(): IEntityContainer {
  const inner = createEntityContainer();
  return {
    ...inner,
    generateEntity(networked?: boolean): Entity {
      let entity = inner.generateEntity(networked);
      // Skip (reserve) any id whose NUMBER is at/below the floor — those numbers are
      // (or could be) code entities in the running engine. Bounded so a malformed
      // floor can't spin. A no-op when floor is 0.
      let guard = 0;
      while (
        floor > 0 &&
        ((entity as number) & ENTITY_NUMBER_MASK) < floor &&
        guard++ < ENTITY_NUMBER_MASK
      ) {
        entity = inner.generateEntity(networked);
      }
      return entity;
    },
  };
}
