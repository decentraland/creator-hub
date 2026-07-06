import type { Entity, IEngine } from '@dcl/ecs';
import { buildChildrenIndex, descendants } from '@dcl/asset-packs';

/**
 * Parent -> children[] index over every entity carrying core::UiTransform. Build once,
 * query many times with descendantsFromIndex (cheaper than rebuilding per root).
 *
 * Delegates to the canonical walk in `@dcl/asset-packs` (the leaf package), supplying the
 * inspector's UiTransform.parent accessor. The runtime in
 * `packages/asset-packs/src/ui-runtime.ts` uses the same helper with a UIDesign.parent
 * accessor.
 */
export function buildUiChildrenIndex(engine: IEngine): Map<Entity, Entity[]> {
  const UiTransform = engine.getComponent('core::UiTransform');
  return buildChildrenIndex(
    engine.getEntitiesWith(UiTransform),
    value => (value as unknown as { parent?: Entity }).parent,
  );
}

// Inclusive DFS of root + all descendants over a prebuilt children index.
export { descendants as descendantsFromIndex };

/**
 * Walk the `core::UiTransform` parent index and return every descendant of
 * `root` (inclusive). Used by variable / binding cascade operations.
 */
export function collectDescendants(engine: IEngine, root: Entity): Set<Entity> {
  return descendants(buildUiChildrenIndex(engine), root);
}
