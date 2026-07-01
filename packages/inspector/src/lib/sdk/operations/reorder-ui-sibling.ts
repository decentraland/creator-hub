import type {
  Entity,
  IEngine,
  LastWriteWinElementSetComponentDefinition,
  PBUiTransform,
} from '@dcl/ecs';

const UI_TRANSFORM_ID = 'core::UiTransform';

// Move `child` to be immediately right of `leftSibling`. If `leftSibling` is
// `undefined`, place `child` first under its parent (rightOf = 0).
//
// `PBUiTransform.rightOf` is a flat `number` field on the proto (verified in
// node_modules/@dcl/ecs/dist/components/generated/pb/decentraland/sdk/components/ui_transform.gen.d.ts:101).
export function reorderUISibling(engine: IEngine) {
  return function reorderUISibling(child: Entity, leftSibling: Entity | undefined): boolean {
    const UiTransform = engine.getComponentOrNull(
      UI_TRANSFORM_ID,
    ) as LastWriteWinElementSetComponentDefinition<PBUiTransform> | null;
    if (!UiTransform) return false;
    if (!UiTransform.has(child)) return false;

    const current = UiTransform.getOrNull(child) ?? ({} as PBUiTransform);
    UiTransform.createOrReplace(child, {
      ...current,
      rightOf: leftSibling ? (leftSibling as unknown as number) : 0,
    } as unknown as PBUiTransform);
    return true;
  };
}

export default reorderUISibling;
