import type { IEngine } from '@dcl/ecs';
import type { VersionedComponents } from '@dcl/asset-packs';

import { BaseComponentNames } from './base-names';
import {
  VERSIONS_REGISTRY,
  getLatestVersionName,
  defineAllComponents,
  migrateAll,
  type COMPONENT_REGISTRY,
} from './registry';

export { BaseComponentNames };
export { VERSIONS_REGISTRY, getLatestVersionName, migrateAll };

export type InspectorVersionedComponents = VersionedComponents<typeof COMPONENT_REGISTRY>;

export function defineAllVersionedComponents(engine: IEngine): InspectorVersionedComponents {
  return defineAllComponents(engine) as InspectorVersionedComponents;
}
