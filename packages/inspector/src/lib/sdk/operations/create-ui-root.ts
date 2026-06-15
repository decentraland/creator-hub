import type {
  Entity,
  IEngine,
  LastWriteWinElementSetComponentDefinition,
  PBUiTransform,
} from '@dcl/ecs';
import { UiTransform as UiTransformEngine, Name as NameEngine } from '@dcl/ecs';
import type { UI } from '@dcl/asset-packs';
import { ComponentName } from '@dcl/asset-packs';

import {
  DEFAULT_CANVAS_HEIGHT,
  DEFAULT_CANVAS_WIDTH,
} from '../../../components/UIDesigner/tree-model';
import { generateUniqueName } from './add-child';

// PBUiTransform uses YGUnit enum (const enum in @dcl/ecs):
//   YGU_UNDEFINED = 0, YGU_POINT = 1, YGU_PERCENT = 2, YGU_AUTO = 3
// PBUiTransform uses YGFlexDirection enum:
//   YGFD_ROW = 0, YGFD_COLUMN = 1, YGFD_COLUMN_REVERSE = 2, YGFD_ROW_REVERSE = 3
// PBUiTransform uses YGDisplay enum:
//   YGD_FLEX = 0 (default), YGD_NONE = 1
const YGU_PERCENT = 2;
const YGFD_COLUMN = 1;

export function createUIRoot(engine: IEngine) {
  return function createUIRoot(name: string): Entity {
    const entity = engine.addEntity();
    const UIComp = engine.getComponent(
      ComponentName.UI,
    ) as LastWriteWinElementSetComponentDefinition<UI>;
    const UiTransform = engine.getComponent(
      UiTransformEngine.componentName,
    ) as LastWriteWinElementSetComponentDefinition<PBUiTransform>;
    const Name = engine.getComponent(NameEngine.componentName) as typeof NameEngine;

    const uniqueName = generateUniqueName(engine, Name, name);

    UIComp.createOrReplace(entity, {
      name: uniqueName,
      visible: true,
      canvasWidth: DEFAULT_CANVAS_WIDTH,
      canvasHeight: DEFAULT_CANVAS_HEIGHT,
      variables: [],
    });
    UiTransform.createOrReplace(entity, {
      width: 100,
      widthUnit: YGU_PERCENT,
      height: 100,
      heightUnit: YGU_PERCENT,
      flexDirection: YGFD_COLUMN,
    } as PBUiTransform);
    Name.createOrReplace(entity, { value: uniqueName });

    return entity;
  };
}

export default createUIRoot;
