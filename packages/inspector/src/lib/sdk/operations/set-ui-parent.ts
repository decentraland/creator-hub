import type {
  Entity,
  IEngine,
  LastWriteWinElementSetComponentDefinition,
  PBUiTransform,
} from '@dcl/ecs';

// Canonical SDK UI component IDs (verified against
// node_modules/@dcl/ecs/dist/components/generated/component-names.gen.js).
const UI_TRANSFORM_ID = 'core::UiTransform';

// Reparent `child` under `newParent`. Returns `false` if the move would create
// a cycle (i.e. `newParent` is already inside `child`'s subtree) or if either
// entity lacks a UiTransform.
export function setUIParent(engine: IEngine) {
  return function setUIParent(child: Entity, newParent: Entity): boolean {
    if (child === newParent) return false;
    const UiTransform = engine.getComponentOrNull(
      UI_TRANSFORM_ID,
    ) as LastWriteWinElementSetComponentDefinition<PBUiTransform> | null;
    if (!UiTransform) return false;
    if (!UiTransform.has(child) || !UiTransform.has(newParent)) return false;

    // Cycle detection: walk newParent's ancestry; if we hit `child`, reject.
    // `parent` on PBUiTransform is a flat `number` field. We treat `0`/falsy as
    // "no parent" since the proto encodes "no parent" as the default integer.
    let cursor: Entity | undefined = newParent;
    const guard = new Set<Entity>();
    while (cursor !== undefined && !guard.has(cursor)) {
      if (cursor === child) return false;
      guard.add(cursor);
      const nextRaw: number | undefined = UiTransform.getOrNull(cursor)?.parent;
      cursor = nextRaw ? (nextRaw as unknown as Entity) : undefined;
    }

    const current = UiTransform.getOrNull(child) ?? ({} as PBUiTransform);
    UiTransform.createOrReplace(child, {
      ...current,
      parent: newParent as unknown as number,
      // Clear sibling-order hint so the moved node lands at the natural end of
      // the new parent's children. Callers wishing to control insertion order
      // should follow up with `reorderUISibling`.
      rightOf: 0,
    } as unknown as PBUiTransform);
    return true;
  };
}

export default setUIParent;
