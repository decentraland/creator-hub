import type { UINodeType } from '../../shared/tree-model';
import {
  BUTTON_GROUP,
  buildLayoutGroup,
  DROPDOWN_EVENTS_GROUP,
  DROPDOWN_GROUP,
  INPUT_EVENTS_GROUP,
  INPUT_GROUP,
  MOUSE_EVENTS_GROUP,
  POSITION_GROUP,
  STYLE_GROUP,
  TEXT_GROUP,
} from './field-configs.groups';
import type { FieldConfig, NodeFieldConfig } from './field-configs.types';

export * from './field-configs.types';
export {
  bindPathFor,
  isBindableProp,
  KIND_TO_CODE_TYPES,
  TRANSFORM,
} from './field-configs.constants';
export { buildLayoutGroup, POSITION_GROUP, POSITION_MODE_FIELD } from './field-configs.groups';

export const NODE_FIELD_CONFIGS: Record<UINodeType, NodeFieldConfig> = {
  UiEntity: { groups: [STYLE_GROUP, MOUSE_EVENTS_GROUP] },
  Label: { groups: [TEXT_GROUP, STYLE_GROUP, MOUSE_EVENTS_GROUP] },
  Button: { groups: [BUTTON_GROUP, TEXT_GROUP, STYLE_GROUP, MOUSE_EVENTS_GROUP] },
  Input: { groups: [INPUT_GROUP, STYLE_GROUP, INPUT_EVENTS_GROUP, MOUSE_EVENTS_GROUP] },
  Dropdown: {
    groups: [DROPDOWN_GROUP, STYLE_GROUP, DROPDOWN_EVENTS_GROUP, MOUSE_EVENTS_GROUP],
  },
};

export const isEventGroup = (title: string) => /event/i.test(title);

/** The panel's complete group list for a node type, in render order: Position → Layout → content groups → event groups. */
export function buildGroups(type: UINodeType): { title: string; fields: FieldConfig[] }[] {
  const { groups } = NODE_FIELD_CONFIGS[type];
  return [
    POSITION_GROUP,
    buildLayoutGroup(type === 'UiEntity'),
    ...groups.filter(g => !isEventGroup(g.title)),
    ...groups.filter(g => isEventGroup(g.title)),
  ];
}
