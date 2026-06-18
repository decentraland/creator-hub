/**
 * Consolidated id / entity-mapping primitives used by both the clone flow
 * (`clone.ts`) and the spawn flow (`add-child.ts` + `actions.ts`'s
 * `handleSpawnEntity`). Centralising these primitives removes the duplication
 * between the two flows and gives a single source of truth for:
 *
 *   - allocating fresh numeric IDs (`getNextId`) for id-bearing components,
 *   - tracking the old-id → new-id rewrite across a clone/spawn pass,
 *   - tracking the composite-entity → live-entity rewrite,
 *   - remapping Trigger `actions[].id` / `conditions[].id` placeholder refs.
 *
 * The Trigger remap helpers come in two shapes: an `IdMap`-based variant that
 * walks numeric old→new IDs (used by `clone.ts`), and a string-placeholder
 * variant in `add-child.ts` (`remapTriggerReferences`) that resolves
 * `{self:Component}` / `{N:Component}` shapes. They share the underlying
 * data structures here.
 */

import type { ComponentDefinition, Entity, IEngine } from '@dcl/ecs';
import { EntityMappingMode, type LastWriteWinElementSetComponentDefinition } from '@dcl/ecs';
import type { Counter } from './definitions';
import { ComponentName } from './enums';

// ─── Id-bearing component metadata ──────────────────────────────────────────

export const COMPONENTS_WITH_ID: string[] = [
  ComponentName.ACTIONS,
  ComponentName.STATES,
  ComponentName.COUNTER,
];

export function getCounterComponent(engine: IEngine) {
  return engine.getComponent(
    ComponentName.COUNTER,
  ) as LastWriteWinElementSetComponentDefinition<Counter>;
}

export function getNextId(engine: IEngine): number {
  const Counter = getCounterComponent(engine);
  const counter = Counter.getOrCreateMutable(engine.RootEntity);
  return ++counter.value;
}

export function requiresId<T extends { id: string }>(
  component: ComponentDefinition<unknown>,
): component is ComponentDefinition<T> {
  return COMPONENTS_WITH_ID.includes(component.componentName);
}

// ─── Numeric id rewrite map (old → new) ─────────────────────────────────────

export interface IdMap {
  remember(oldId: number, newId: number): void;
  resolve(oldId: number): number | undefined;
  entries(): Iterable<[number, number]>;
}

export function createIdMap(): IdMap {
  const map = new Map<number, number>();
  return {
    remember(oldId, newId) {
      map.set(oldId, newId);
    },
    resolve(oldId) {
      return map.get(oldId);
    },
    entries() {
      return map.entries();
    },
  };
}

// ─── Composite-entity → live-entity rewrite map ─────────────────────────────

export interface EntityMap {
  put(src: Entity, dst: Entity): void;
  get(src: Entity): Entity | undefined;
  /**
   * Get the live entity for a composite-entity-id, or allocate a fresh live
   * entity via `engine.addEntity()` and remember the mapping on first call.
   * Used as the `getCompositeEntity` callback for `EMM_DIRECT_MAPPING`.
   */
  getOrAllocate(src: Entity, engine: IEngine): Entity;
  /**
   * Build an `entityMapping` value suitable for passing to
   * `Composite.instance(engine, resource, provider, { entityMapping })`.
   * Composite.instance calls the returned `getCompositeEntity` exactly once
   * per composite entity it instantiates, so the map ends up containing the
   * full composite-entity → live-entity correspondence after instance returns.
   */
  toDirectMapping(engine: IEngine): {
    type: EntityMappingMode.EMM_DIRECT_MAPPING;
    getCompositeEntity: (entity: Entity | number) => Entity;
  };
  entries(): Iterable<[Entity, Entity]>;
}

export function createEntityMap(): EntityMap {
  const map = new Map<Entity, Entity>();
  const self: EntityMap = {
    put(src, dst) {
      map.set(src, dst);
    },
    get(src) {
      return map.get(src);
    },
    getOrAllocate(src, engine) {
      const cached = map.get(src);
      if (cached !== undefined) return cached;
      const dst = engine.addEntity();
      map.set(src, dst);
      return dst;
    },
    toDirectMapping(engine) {
      return {
        type: EntityMappingMode.EMM_DIRECT_MAPPING,
        getCompositeEntity: (e: Entity | number) => self.getOrAllocate(e as Entity, engine),
      };
    },
    entries() {
      return map.entries();
    },
  };
  return self;
}

// ─── Trigger reference remap (numeric IdMap variant) ────────────────────────

// Structural shape used by both Action and Condition entries on a Trigger.
// We only ever read/write `.id`; the rest of the entry is irrelevant.
type IdHolder = { id?: number | string | unknown };
type TriggerLike = { actions: IdHolder[]; conditions?: IdHolder[] };

/**
 * Rewrite numeric `id` references on each trigger's actions and conditions
 * using the supplied old→new map. Used by the clone flow, where IDs are
 * already numeric (live), not the `{self:...}` string placeholders that the
 * spawn flow consumes.
 */
export function remapTriggerActionRefs<T extends TriggerLike>(triggers: T[], idMap: IdMap): void {
  for (const trigger of triggers) {
    for (const action of trigger.actions) {
      if (typeof action.id === 'number') {
        const newId = idMap.resolve(action.id);
        if (newId !== undefined) action.id = newId;
      }
    }
    if (trigger.conditions) {
      for (const condition of trigger.conditions) {
        if (typeof condition.id === 'number') {
          const newId = idMap.resolve(condition.id);
          if (newId !== undefined) condition.id = newId;
        }
      }
    }
  }
}

/**
 * Rewrite `parent`-style Entity references on each trigger using the
 * composite-entity → live-entity map. Currently unused (the asset-packs
 * Trigger schema does not reference cross-entity composites by raw entity id
 * — it uses the `{N:Component}` placeholder shape which is resolved via the
 * `IdMap` variant). Kept here as the canonical primitive in case a future
 * trigger field carries a raw `Entity` reference.
 */
export function remapTriggerEntityRefs<T extends { entity?: Entity }>(
  refs: T[],
  entityMap: EntityMap,
): void {
  for (const ref of refs) {
    if (ref.entity !== undefined) {
      const remapped = entityMap.get(ref.entity);
      if (remapped !== undefined) ref.entity = remapped;
    }
  }
}
