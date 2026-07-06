import type { Entity } from '@dcl/ecs';

/**
 * Build a parent -> children[] index from an iterable of `(entity, value)` entries.
 * `getParent` extracts the parent entity from each value (returns `undefined` for roots
 * / unparented nodes, which are skipped).
 *
 * Generic over the value type so a single implementation serves both the UI Designer
 * runtime (walks `asset-packs::UIDesign.parent`) and the inspector (walks the live
 * `core::UiTransform.parent`). asset-packs is the leaf package, so the canonical walk
 * lives here and the inspector imports it.
 */
export function buildChildrenIndex<T>(
  entries: Iterable<readonly [Entity, T]>,
  getParent: (value: T) => Entity | undefined,
): Map<Entity, Entity[]> {
  const childrenOf = new Map<Entity, Entity[]>();
  for (const [entity, value] of entries) {
    const parent = getParent(value);
    if (parent === undefined) continue;
    const siblings = childrenOf.get(parent) ?? [];
    siblings.push(entity);
    childrenOf.set(parent, siblings);
  }
  return childrenOf;
}

/** Inclusive DFS of `root` + every descendant over a prebuilt children index. */
export function descendants(index: Map<Entity, Entity[]>, root: Entity): Set<Entity> {
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
