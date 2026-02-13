import type { IEngine } from '@dcl/ecs';
import { migrateVersionedComponent } from '@dcl/asset-packs';
import { VERSIONS_REGISTRY } from '../../../../sdk/components/versioning/constants';

export function migrateInspectorComponents(engine: IEngine) {
  Object.entries(VERSIONS_REGISTRY).forEach(([baseName, versions]) => {
    migrateVersionedComponent(engine, baseName, versions);
  });
}
