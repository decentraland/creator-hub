import type {
  Entity,
  IEngine,
  LastWriteWinElementSetComponentDefinition,
  NameComponent,
  PBUiBackground,
  PBUiDropdown,
  PBUiInput,
  PBUiText,
  PBUiTransform,
} from '@dcl/ecs';

import type { UINodeType } from '../../../components/UIDesigner/tree-model';
import { generateUniqueUiName } from './add-child';

// Canonical SDK UI component IDs (verified against
// node_modules/@dcl/ecs/dist/components/generated/component-names.gen.js).
const COMPONENT_IDS = {
  UiTransform: 'core::UiTransform',
  UiBackground: 'core::UiBackground',
  UiText: 'core::UiText',
  UiInput: 'core::UiInput',
  UiDropdown: 'core::UiDropdown',
  Name: 'core-schema::Name',
} as const;

// Default Name set on each new UI node so it surfaces in the auto-generated
// `entity-names.ts` and can be referenced from scene code. The generator
// (engine-to-composite.ts:generateEntityNamesType) deduplicates collisions
// with `_1`, `_2`, … suffixes, so dropping three Labels lands as
// `Label`, `Label_1`, `Label_2`.
const DEFAULT_NAMES: Record<UINodeType, string> = {
  UiEntity: 'Container',
  Label: 'Label',
  Button: 'Button',
  Input: 'Input',
  Dropdown: 'Dropdown',
};

// PB enums are erased `const enum`s in @dcl/ecs; inline numeric literals here.
// YGUnit: YGU_UNDEFINED=0, YGU_POINT=1, YGU_PERCENT=2, YGU_AUTO=3
// YGDisplay: YGD_FLEX=0, YGD_NONE=1
// YGFlexDirection: YGFD_ROW=0, YGFD_COLUMN=1, YGFD_COLUMN_REVERSE=2, YGFD_ROW_REVERSE=3
// YGJustify: YGJ_FLEX_START=0, YGJ_CENTER=1, YGJ_FLEX_END=2, YGJ_SPACE_BETWEEN=3,
//            YGJ_SPACE_AROUND=4, YGJ_SPACE_EVENLY=5
// YGAlign: YGA_AUTO=0, YGA_FLEX_START=1, YGA_CENTER=2, YGA_FLEX_END=3, YGA_STRETCH=4, ...
// BackgroundTextureMode: NINE_SLICES=0, CENTER=1, STRETCH=2
const YGU_POINT = 1; /* YGUnit_Point */
const YGU_AUTO = 3; /* YGUnit_Auto */
const YGD_FLEX = 0; /* YGDisplay_Flex */
const YGJ_CENTER = 1; /* YGJustify_Center */
const YGA_CENTER = 2; /* YGAlign_Center */
const BG_NINE_SLICES = 0; /* BackgroundTextureMode_NINE_SLICES */

const WHITE = { r: 1, g: 1, b: 1, a: 1 };
const BLUE = { r: 0.2, g: 0.4, b: 0.8, a: 1 };

// PB `repeated` fields are non-optional; they must be present (at least as
// an empty array) for the serializer to walk them. UiBackground has `uvs`
// which the gen'd encoder iterates unconditionally — missing it crashes the
// CRDT serializer ("message.uvs is not iterable"). The default UV winding
// is documented in ui_background.proto as `[0,0,0,1,1,0,1,0]`.
const DEFAULT_UVS: number[] = [0, 0, 0, 1, 1, 0, 1, 0];

export function addUINode(engine: IEngine) {
  return function addUINode(parent: Entity, type: UINodeType): Entity {
    const entity = engine.addEntity();
    const UiTransform = engine.getComponent(
      COMPONENT_IDS.UiTransform,
    ) as LastWriteWinElementSetComponentDefinition<PBUiTransform>;
    const UiBackground = engine.getComponent(
      COMPONENT_IDS.UiBackground,
    ) as LastWriteWinElementSetComponentDefinition<PBUiBackground>;
    const UiText = engine.getComponent(
      COMPONENT_IDS.UiText,
    ) as LastWriteWinElementSetComponentDefinition<PBUiText>;
    const UiInput = engine.getComponent(
      COMPONENT_IDS.UiInput,
    ) as LastWriteWinElementSetComponentDefinition<PBUiInput>;
    const UiDropdown = engine.getComponent(
      COMPONENT_IDS.UiDropdown,
    ) as LastWriteWinElementSetComponentDefinition<PBUiDropdown>;
    const NameComp = engine.getComponentOrNull(COMPONENT_IDS.Name) as NameComponent | null;
    if (NameComp) {
      // Globally-unique name (Label, Label_1, …) so engine.getEntityByName resolves each
      // node unambiguously — the codegen enum-key dedup alone leaves the Name *values*
      // colliding, which breaks getEntityByName from scene code.
      NameComp.createOrReplace(entity, {
        value: generateUniqueUiName(engine, NameComp, DEFAULT_NAMES[type]),
      });
    }

    switch (type) {
      case 'UiEntity':
        UiTransform.createOrReplace(entity, {
          parent,
          display: YGD_FLEX,
          width: 100,
          widthUnit: YGU_POINT,
          height: 100,
          heightUnit: YGU_POINT,
        } as unknown as PBUiTransform);
        break;
      case 'Label':
        UiTransform.createOrReplace(entity, {
          parent,
          display: YGD_FLEX,
          width: 0,
          widthUnit: YGU_AUTO,
          height: 0,
          heightUnit: YGU_AUTO,
        } as unknown as PBUiTransform);
        UiText.createOrReplace(entity, {
          value: 'Label',
          fontSize: 16,
          color: WHITE,
        } as unknown as PBUiText);
        break;
      case 'Button':
        UiTransform.createOrReplace(entity, {
          parent,
          display: YGD_FLEX,
          width: 120,
          widthUnit: YGU_POINT,
          height: 36,
          heightUnit: YGU_POINT,
          justifyContent: YGJ_CENTER,
          alignItems: YGA_CENTER,
        } as unknown as PBUiTransform);
        UiBackground.createOrReplace(entity, {
          color: BLUE,
          textureMode: BG_NINE_SLICES,
          uvs: DEFAULT_UVS,
        } as unknown as PBUiBackground);
        UiText.createOrReplace(entity, {
          value: 'Button',
          fontSize: 14,
          color: WHITE,
        } as unknown as PBUiText);
        break;
      case 'Input':
        UiTransform.createOrReplace(entity, {
          parent,
          display: YGD_FLEX,
          width: 200,
          widthUnit: YGU_POINT,
          height: 36,
          heightUnit: YGU_POINT,
        } as unknown as PBUiTransform);
        UiInput.createOrReplace(entity, {
          placeholder: 'Enter text',
          disabled: false,
        } as unknown as PBUiInput);
        break;
      case 'Dropdown':
        UiTransform.createOrReplace(entity, {
          parent,
          display: YGD_FLEX,
          width: 200,
          widthUnit: YGU_POINT,
          height: 36,
          heightUnit: YGU_POINT,
        } as unknown as PBUiTransform);
        UiDropdown.createOrReplace(entity, {
          acceptEmpty: false,
          disabled: false,
          options: ['Option 1', 'Option 2'],
          selectedIndex: 0,
        } as unknown as PBUiDropdown);
        break;
    }
    return entity;
  };
}

export default addUINode;
