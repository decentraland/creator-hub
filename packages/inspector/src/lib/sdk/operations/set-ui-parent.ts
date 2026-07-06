import type {
  Entity,
  IEngine,
  LastWriteWinElementSetComponentDefinition,
  PBUiTransform,
} from '@dcl/ecs';

import { YGPT_ABSOLUTE, YGPT_RELATIVE, YGU_POINT, YGU_UNDEFINED } from '../ui-transform-constants';

// Canonical SDK UI component IDs (verified against
// node_modules/@dcl/ecs/dist/components/generated/component-names.gen.js).
const UI_TRANSFORM_ID = 'core::UiTransform';

export interface SetUIParentOptions {
  // New-parent-relative offset (logical px) to bake in the same write as the
  // reparent, so an absolutely-positioned node keeps its on-screen position.
  // Computed by the caller from DOM rects (see measure.ts:measureReparentOffset)
  // — this operation has no DOM access. Ignored for in-flow nodes.
  position?: { top: number; left: number };
}

// Reparent `child` under `newParent`. Returns `false` if the move would create
// a cycle (i.e. `newParent` is already inside `child`'s subtree) or if either
// entity lacks a UiTransform.
export function setUIParent(engine: IEngine) {
  return function setUIParent(
    child: Entity,
    newParent: Entity,
    opts?: SetUIParentOptions,
  ): boolean {
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
    const currentIsAbsolute =
      ((current as unknown as { positionType?: number }).positionType ?? YGPT_RELATIVE) ===
      YGPT_ABSOLUTE;
    // Only absolute nodes get their offsets rebased: their Top/Left px are
    // parent-relative, so keeping the old numbers against a new parent's box is
    // exactly the "jumps somewhere unexpected" bug. In-flow nodes reflow.
    const positionPatch =
      opts?.position && currentIsAbsolute
        ? {
            positionTop: opts.position.top,
            positionTopUnit: YGU_POINT,
            positionLeft: opts.position.left,
            positionLeftUnit: YGU_POINT,
            positionRight: 0,
            positionRightUnit: YGU_UNDEFINED,
            positionBottom: 0,
            positionBottomUnit: YGU_UNDEFINED,
          }
        : {};
    UiTransform.createOrReplace(child, {
      ...current,
      ...positionPatch,
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
