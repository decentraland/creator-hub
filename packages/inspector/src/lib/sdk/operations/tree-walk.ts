import type { Entity, IEngine } from '@dcl/ecs';

/**
 * Walk the `core::UiTransform` parent index and return every descendant of
 * `root` (inclusive). Used by variable / binding cascade operations.
 *
 * Mirrors the parent-index DFS pattern also present in
 * `packages/asset-packs/src/ui-runtime.ts` and
 * `packages/inspector/src/lib/data-layer/host/utils/engine-to-composite.ts`;
 * those sites are not unified into this helper because they live in a
 * different package or cast `Entity` through `unknown as number` — see the
 * Future-work note in this spec's `plan.md`.
 */
export function collectDescendants(engine: IEngine, root: Entity): Set<Entity> {
  const UiTransform = engine.getComponent('core::UiTransform');
  const childrenOf = new Map<Entity, Entity[]>();
  for (const [entity, value] of engine.getEntitiesWith(UiTransform)) {
    const parent = (value as unknown as { parent?: Entity }).parent;
    if (parent === undefined) continue;
    const list = childrenOf.get(parent) ?? [];
    list.push(entity);
    childrenOf.set(parent, list);
  }
  const out = new Set<Entity>();
  const stack: Entity[] = [root];
  while (stack.length) {
    const e = stack.pop()!;
    if (out.has(e)) continue;
    out.add(e);
    for (const c of childrenOf.get(e) ?? []) stack.push(c);
  }
  return out;
}
