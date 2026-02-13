import type { LastWriteWinElementSetComponentDefinition } from '@dcl/ecs';
import type { InspectorVersionedComponents } from './versioning/constants';
import type { BaseComponentNames } from './versioning/base-names';

// Utility type to extract value from component definition
type ComponentValue<T> = T extends LastWriteWinElementSetComponentDefinition<infer V> ? V : never;

// Type automatically inferred from last version in CONFIG_VERSIONS array
export type ConfigComponentType = ComponentValue<
  InspectorVersionedComponents[typeof BaseComponentNames.CONFIG]
>;
