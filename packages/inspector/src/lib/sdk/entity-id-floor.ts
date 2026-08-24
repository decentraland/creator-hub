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

// An entity id packs a 16-bit NUMBER (low) and a 16-bit VERSION (high):
// `id = (number & 0xffff) | (version << 16)`. The floor is a NUMBER floor — a code
// entity and an editor entity collide by number regardless of version — so anything
// derived from a raw entity id must be masked to the low 16 bits first, and the floor
// itself can never be >= the number space or allocation would starve (#1468).
const ENTITY_NUMBER_MASK = 0xffff;
// One below the max entity number: a floor at/above this leaves no allocatable id, so
// we refuse it rather than brick the editor's entity allocator.
const MAX_FLOOR = ENTITY_NUMBER_MASK - 1;

// Module-level, single floor. This assumes ONE editor session at a time (single-
// instance Electron app): the active Bevy renderer publishes here and the inspector
// engine reads here, with resetEntityIdFloor() on dispose returning to a clean slate.
// If the editor ever hosts concurrent renderer/scene instances, this shared global
// would need to become per-instance (the two engines would otherwise fight over it).
let floor = 0;

/** The current floor: new editor entities are allocated with a number > this. */
export function getEntityIdFloor(): number {
  return floor;
}

/** Raise the floor to the running renderer's max live entity NUMBER (monotonic within a
 * scene session). Never lowers it — a transient smaller reading can't reintroduce a
 * collision — and never raises it to an unsatisfiable value (a bad/huge reading would
 * otherwise make every id get skipped until the 16-bit number space is exhausted). */
export function setEntityIdFloor(maxLiveEntityNumber: number): void {
  const next = maxLiveEntityNumber & ENTITY_NUMBER_MASK;
  if (next > floor && next <= MAX_FLOOR) floor = next;
}

/** Clear the floor when the renderer is torn down (scene close / switch), so the next
 * scene — or a Babylon scene — starts from a clean slate. */
export function resetEntityIdFloor(): void {
  floor = 0;
}

/**
 * Parse the engine's `/scene_entities` reply into the highest live entity NUMBER. The
 * reply is one entity per line — decimal entity ids plus non-numeric aliases (root,
 * player, camera) or `(no entities)`. Each id is the PACKED value `number | version<<16`,
 * so mask off the version (low 16 bits) before comparing — otherwise a reloaded scene's
 * version-bumped ids read as values far above the 16-bit number space and the floor
 * becomes unsatisfiable. Take the max masked number (0 if none). The renderer feeds this
 * to {@link setEntityIdFloor}.
 */
export function parseMaxLiveEntityId(sceneEntitiesReply: string): number {
  let max = 0;
  for (const line of sceneEntitiesReply.split('\n')) {
    const n = Number(line.trim());
    if (!Number.isFinite(n)) continue;
    const number = n & ENTITY_NUMBER_MASK;
    if (number > max) max = number;
  }
  return max;
}

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
