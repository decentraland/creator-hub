import type {
  Entity,
  IEngine,
  LastWriteWinElementSetComponentDefinition,
  NameComponent,
} from '@dcl/ecs';

import { isLastWriteWinComponent } from '../../../hooks/sdk/useComponentValue';
import { collectDescendants } from './tree-walk';
import reorderUISibling from './reorder-ui-sibling';
import { generateUniqueUiName } from './add-child';

const UI_TRANSFORM_ID = 'core::UiTransform';
const NAME_ID = 'core-schema::Name';

type UiTransformShape = { parent?: number; rightOf?: number };

/**
 * Deep-clone a UI subtree (parented via `core::UiTransform.parent`) and attach
 * the copy as a sibling of the original, immediately after it.
 *
 * Unlike the generic `duplicateEntity`, this walks the UiTransform parent index
 * (UI nodes have no `core::Transform` and are absent from the editor `Nodes`
 * tree) and copies every LWW component verbatim — UiTransform / UiBackground /
 * UiText / UiInput / UiDropdown / Name / `asset-packs::UI` / `asset-packs::UIBindings`
 * — remapping intra-subtree `parent`/`rightOf` pointers to the clones. Copy-all
 * is safe because UI entities only ever carry UI components, and it auto-carries
 * the marker, bindings, and any future UI component.
 */
export function duplicateUINode(engine: IEngine) {
  const reorder = reorderUISibling(engine);

  return function duplicateUINode(entity: Entity): Entity {
    // Inclusive subtree of `entity` over the UiTransform parent index.
    const subtree = collectDescendants(engine, entity);

    // 1) Allocate one clone per original.
    const map = new Map<Entity, Entity>();
    for (const original of subtree) {
      map.set(original, engine.addEntity());
    }

    // 2) Copy every LWW component the original carries onto its clone.
    for (const component of engine.componentsIter()) {
      if (!isLastWriteWinComponent(component)) continue;
      for (const original of subtree) {
        if (!component.has(original)) continue;
        const clone = map.get(original)!;
        const value = JSON.parse(JSON.stringify(component.get(original)));
        component.createOrReplace(clone, value);
      }
    }

    // 3) Remap intra-subtree UiTransform.parent / rightOf to the clones. The
    //    subtree root's parent points OUTSIDE the subtree, so it stays as-is and
    //    the clone-root attaches as a sibling of the original.
    const UiTransform = engine.getComponentOrNull(
      UI_TRANSFORM_ID,
    ) as LastWriteWinElementSetComponentDefinition<UiTransformShape> | null;
    if (UiTransform) {
      for (const clone of map.values()) {
        const t = UiTransform.getOrNull(clone);
        if (!t) continue;
        const parentClone = map.get(t.parent as unknown as Entity);
        const rightOfClone = map.get(t.rightOf as unknown as Entity);
        UiTransform.createOrReplace(clone, {
          ...t,
          parent: parentClone !== undefined ? (parentClone as unknown as number) : t.parent,
          rightOf: rightOfClone !== undefined ? (rightOfClone as unknown as number) : t.rightOf,
        });
      }
    }

    const cloneRoot = map.get(entity)!;

    // 4) Give every clone a globally-unique core-schema::Name. The copy-all loop
    //    above carried each original's Name verbatim, but UI Name *values* must be
    //    globally unique: scene code resolves UI nodes via engine.getEntityByName and
    //    the generated UiEntityNames enum, and duplicate values make those lookups
    //    ambiguous. generateUniqueName can't help (it walks the editor Nodes tree,
    //    which excludes UiTransform-only UI nodes) — generateUniqueUiName scans the
    //    Name component directly. The clone root additionally gets a "<name> copy"
    //    base. Renaming in-loop (createOrReplace before the next lookup) means each
    //    call sees prior assignments, so siblings dedupe incrementally (Label_1, …).
    const Name = engine.getComponentOrNull(NAME_ID) as NameComponent | null;
    if (Name) {
      for (const [original, clone] of map) {
        const originalName = Name.getOrNull(original)?.value ?? '';
        if (clone === cloneRoot) {
          const base = originalName ? `${originalName} copy` : 'copy';
          Name.createOrReplace(clone, { value: generateUniqueUiName(engine, Name, base) });
        } else if (originalName) {
          Name.createOrReplace(clone, { value: generateUniqueUiName(engine, Name, originalName) });
        }
      }
    }

    // 5) Place the copy immediately after the original among its siblings.
    reorder(cloneRoot, entity);

    return cloneRoot;
  };
}

export default duplicateUINode;
