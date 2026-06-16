import type {
  Entity,
  IEngine,
  LastWriteWinElementSetComponentDefinition,
  PBUiTransform,
} from '@dcl/ecs';
import { UiTransform as UiTransformEngine } from '@dcl/ecs';

// PBUiTransform uses YGUnit enum (const enum in @dcl/ecs):
//   YGU_UNDEFINED = 0, YGU_POINT = 1, YGU_PERCENT = 2, YGU_AUTO = 3
// PBUiTransform uses YGPositionType enum:
//   YGPT_RELATIVE = 0, YGPT_ABSOLUTE = 1
const YGU_PERCENT = 2;
const YGPT_RELATIVE = 0;

/**
 * A UI root is the screen: its size/position are not author-editable (the
 * property panel hides those fields and both the canvas preview and the runtime
 * force it to fill). Legacy roots may have been saved absolute / fixed-px before
 * that rule existed; re-pin them to the canonical 100% × 100% relative shape,
 * preserving flex/padding/other authored fields. Returns true only when
 * something actually changed so the caller can avoid a no-op dispatch.
 */
export function repairUIRoot(engine: IEngine) {
  return function repairUIRoot(root: Entity): boolean {
    const UiTransform = engine.getComponent(
      UiTransformEngine.componentName,
    ) as LastWriteWinElementSetComponentDefinition<PBUiTransform>;
    const current = UiTransform.getOrNull(root);
    if (!current) return false;
    const t = current as unknown as Record<string, number | undefined>;
    const isCanonical =
      t.width === 100 &&
      t.widthUnit === YGU_PERCENT &&
      t.height === 100 &&
      t.heightUnit === YGU_PERCENT &&
      (t.positionType ?? YGPT_RELATIVE) === YGPT_RELATIVE &&
      !t.positionTop &&
      !t.positionRight &&
      !t.positionBottom &&
      !t.positionLeft &&
      !t.marginTop &&
      !t.marginRight &&
      !t.marginBottom &&
      !t.marginLeft;
    if (isCanonical) return false;
    UiTransform.createOrReplace(root, {
      ...current,
      width: 100,
      widthUnit: YGU_PERCENT,
      height: 100,
      heightUnit: YGU_PERCENT,
      positionType: YGPT_RELATIVE,
      positionTop: 0,
      positionRight: 0,
      positionBottom: 0,
      positionLeft: 0,
      marginTop: 0,
      marginRight: 0,
      marginBottom: 0,
      marginLeft: 0,
    } as PBUiTransform);
    return true;
  };
}

export default repairUIRoot;
