import type { Entity, IEngine } from '@dcl/ecs';

/**
 * Parent -> children[] index over every entity carrying core::UiTransform. Build once,
 * query many times with descendantsFromIndex (cheaper than rebuilding per root).
 */
export function buildUiChildrenIndex(engine: IEngine): Map<Entity, Entity[]> {
  const UiTransform = engine.getComponent('core::UiTransform');
  const childrenOf = new Map<Entity, Entity[]>();
  for (const [entity, value] of engine.getEntitiesWith(UiTransform)) {
    const parent = (value as unknown as { parent?: Entity }).parent;
    if (parent === undefined) continue;
    const siblings = childrenOf.get(parent) ?? [];
    siblings.push(entity);
    childrenOf.set(parent, siblings);
  }
  return childrenOf;
}

// Inclusive DFS of root + all descendants over a prebuilt children index.
export function descendantsFromIndex(index: Map<Entity, Entity[]>, root: Entity): Set<Entity> {
  const out = new Set<Entity>();
  const stack: Entity[] = [root];
  while (stack.length) {
    const e = stack.pop() as Entity;
    if (out.has(e)) continue;
    out.add(e);
    for (const child of index.get(e) ?? []) stack.push(child);
  }
  return out;
}

/**
 * Walk the `core::UiTransform` parent index and return every descendant of
 * `root` (inclusive). Used by variable / binding cascade operations.
 *
 * Mirrors the parent-index DFS pattern also present in
 * `packages/asset-packs/src/ui-runtime.ts`; that site is not unified into this
 * helper because it lives in a different package (`@dcl/js-runtime`).
 */
export function collectDescendants(engine: IEngine, root: Entity): Set<Entity> {
  const index = buildUiChildrenIndex(engine);
  return descendantsFromIndex(index, root);
}
