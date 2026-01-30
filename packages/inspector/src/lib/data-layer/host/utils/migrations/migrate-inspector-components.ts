import type { IEngine } from '@dcl/ecs';
import { migrateVersionedComponent } from '@dcl/asset-packs';
import { BaseComponentNames } from '../../../../sdk/components/versioning/constants';
import { NODES_VERSIONS } from '../../../../sdk/components/versioning/definitions/nodes';
import { TRANSFORM_CONFIG_VERSIONS } from '../../../../sdk/components/versioning/definitions/transform-config';

export function migrateInspectorComponents(engine: IEngine) {
  migrateVersionedComponent(engine, BaseComponentNames.NODES, NODES_VERSIONS);
  migrateVersionedComponent(engine, BaseComponentNames.TRANSFORM_CONFIG, TRANSFORM_CONFIG_VERSIONS);
}
