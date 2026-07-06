import type {
  Entity,
  IEngine,
  LastWriteWinElementSetComponentDefinition,
  PBUiTransform,
} from '@dcl/ecs';

const UI_TRANSFORM_ID = 'core::UiTransform';

type UiTransformShape = { parent?: number; rightOf?: number };

// Move `child` to sit immediately after `leftSibling` in its parent's flow
// order (or first, when `leftSibling` is undefined), maintaining the sibling
// `rightOf` linked list like a real list insertion:
//
//   1. UNLINK — any sibling that pointed at `child` is repointed to `child`'s
//      old `rightOf`, closing the gap it leaves behind.
//   2. RELINK — every sibling that claimed the target slot (rightOf ===
//      leftSibling; or the head slot — rightOf 0/dangling — when inserting
//      first) now follows `child`. Repointing ALL claimants keeps legacy
//      all-zero chains convergent: ties order after `child` in stable
//      creation order (matching tree-model's orderSiblings DFS).
//   3. child.rightOf = leftSibling (or 0 for head).
//
// Only `rightOf` fields of same-parent siblings are written — never positions,
// never children, never other entities' fields.
//
// `PBUiTransform.rightOf` is a flat `number` field on the proto (verified in
// node_modules/@dcl/ecs/dist/components/generated/pb/decentraland/sdk/components/ui_transform.gen.d.ts:101).
export function reorderUISibling(engine: IEngine) {
  return function reorderUISibling(child: Entity, leftSibling: Entity | undefined): boolean {
    const UiTransform = engine.getComponentOrNull(
      UI_TRANSFORM_ID,
    ) as LastWriteWinElementSetComponentDefinition<PBUiTransform> | null;
    if (!UiTransform) return false;
    const childT = UiTransform.getOrNull(child) as UiTransformShape | null;
    if (!childT) return false;
    if (leftSibling !== undefined && (leftSibling === child || !UiTransform.has(leftSibling))) {
      return false;
    }

    const parent = childT.parent ?? 0;
    // Same-parent siblings (excluding child), with their current shapes.
    // `getEntitiesWith` is the type-safe iteration over a component's entities
    // (mirrors tree-walk.ts); the raw `.iterator()` isn't on the definition type.
    const siblings: { entity: Entity; t: UiTransformShape }[] = [];
    const siblingSet = new Set<number>();
    for (const [entity, value] of engine.getEntitiesWith(UiTransform) as Iterable<
      [Entity, UiTransformShape]
    >) {
      if (entity === child) continue;
      if ((value?.parent ?? 0) !== parent) continue;
      siblings.push({ entity, t: value });
      siblingSet.add(entity as unknown as number);
    }
    // The anchor must be an actual sibling under the same parent.
    if (leftSibling !== undefined && !siblingSet.has(leftSibling as unknown as number)) {
      return false;
    }

    const write = (entity: Entity, t: UiTransformShape, rightOf: number) => {
      UiTransform.createOrReplace(entity, { ...t, rightOf } as unknown as PBUiTransform);
    };

    // 1) UNLINK: close the gap child leaves behind.
    const oldRight = childT.rightOf ?? 0;
    for (const s of siblings) {
      if ((s.t.rightOf ?? 0) === (child as unknown as number)) {
        write(s.entity, s.t, oldRight);
        s.t = { ...s.t, rightOf: oldRight };
      }
    }

    // 2) RELINK: claimants of the target slot now follow child.
    const target = leftSibling !== undefined ? (leftSibling as unknown as number) : 0;
    for (const s of siblings) {
      const r = s.t.rightOf ?? 0;
      const claimsSlot = target !== 0 ? r === target : r === 0 || !siblingSet.has(r);
      if (claimsSlot) write(s.entity, s.t, child as unknown as number);
    }

    // 3) Place child.
    write(child, childT, target);
    return true;
  };
}

export default reorderUISibling;
