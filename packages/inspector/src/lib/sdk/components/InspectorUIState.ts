import type { LastWriteWinElementSetComponentDefinition } from '@dcl/ecs';
import type { InspectorVersionedComponents } from './versioning/constants';
import type { BaseComponentNames } from './versioning/base-names';

type ComponentValue<T> = T extends LastWriteWinElementSetComponentDefinition<infer V> ? V : never;

export type InspectorUIStateType = ComponentValue<
  InspectorVersionedComponents[typeof BaseComponentNames.INSPECTOR_UI_STATE]
>;
