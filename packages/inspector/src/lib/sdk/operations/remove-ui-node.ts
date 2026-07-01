import type { Entity, IEngine } from '@dcl/ecs';

import { isLastWriteWinComponent } from '../../../hooks/sdk/useComponentValue';
import { collectDescendants } from './tree-walk';

/**
 * Delete a UI subtree (parented via `core::UiTransform.parent`) and every
 * descendant.
 *
 * The generic `removeEntity` is a no-op here: it walks `getComponentEntityTree`
 * over `core::Transform`, but UI nodes carry only `core::UiTransform` (no
 * `core::Transform`) and so are absent from that index — the generator yields
 * nothing and deletes nothing. This walks the UiTransform parent index instead
 * (via `collectDescendants`) and removes every LWW component from each entity,
 * the same `deleteFrom` technique `removeEntity` uses to emit DELETE_COMPONENT
 * CRDT messages. The engine drops an entity once it carries no components.
 *
 * Copy-all-LWW is safe because UI entities only ever carry UI components, and it
 * auto-handles the marker (`asset-packs::UI`), bindings, and any future UI
 * component — mirroring `duplicateUINode`. Unlike `removeEntity` this does NOT
 * touch the editor `Nodes` tree: UI nodes never appear there, so writing it back
 * per entity would be wasted CRDT traffic.
 *
 * Returns the inclusive subtree it removed so callers can resolve selection
 * fallback without recomputing it post-delete.
 */
export function removeUINode(engine: IEngine) {
  return function removeUINode(root: Entity): Set<Entity> {
    // Collect BEFORE deleting — collectDescendants walks core::UiTransform.parent,
    // which we are about to delete.
    const subtree = collectDescendants(engine, root);
    for (const entity of subtree) {
      for (const component of engine.componentsIter()) {
        if (component.has(entity) && isLastWriteWinComponent(component)) {
          component.deleteFrom(entity);
        }
      }
    }
    return subtree;
  };
}

export default removeUINode;
