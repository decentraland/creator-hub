import type { ISchema, LastWriteWinElementSetComponentDefinition } from '@dcl/ecs';
import type { IEngine } from '@dcl/ecs';
import { BaseComponentNames } from '../constants';
import {
  COUNTER_VERSIONS,
  TRIGGERS_VERSIONS,
  ACTION_TYPES_VERSIONS,
  ACTIONS_VERSIONS,
  STATES_VERSIONS,
  COUNTER_BAR_VERSIONS,
  ADMIN_TOOLS_VERSIONS,
  VIDEO_SCREEN_VERSIONS,
  REWARDS_VERSIONS,
  TEXT_ANNOUNCEMENTS_VERSIONS,
  VIDEO_CONTROL_STATE_VERSIONS,
  SCRIPT_VERSIONS,
} from './definitions';

export type VersionedComponent = {
  versionName: string;
  component: Record<string, ISchema>;
};

const VERSIONS_REGISTRY: Record<string, VersionedComponent[]> = {
  [BaseComponentNames.COUNTER]: COUNTER_VERSIONS,
  [BaseComponentNames.TRIGGERS]: TRIGGERS_VERSIONS,
  [BaseComponentNames.ACTION_TYPES]: ACTION_TYPES_VERSIONS,
  [BaseComponentNames.ACTIONS]: ACTIONS_VERSIONS,
  [BaseComponentNames.STATES]: STATES_VERSIONS,
  [BaseComponentNames.COUNTER_BAR]: COUNTER_BAR_VERSIONS,
  [BaseComponentNames.ADMIN_TOOLS]: ADMIN_TOOLS_VERSIONS,
  [BaseComponentNames.VIDEO_SCREEN]: VIDEO_SCREEN_VERSIONS,
  [BaseComponentNames.REWARDS]: REWARDS_VERSIONS,
  [BaseComponentNames.TEXT_ANNOUNCEMENTS]: TEXT_ANNOUNCEMENTS_VERSIONS,
  [BaseComponentNames.VIDEO_CONTROL_STATE]: VIDEO_CONTROL_STATE_VERSIONS,
  [BaseComponentNames.SCRIPT]: SCRIPT_VERSIONS,
};

export function migrateVersionedComponent(
  engine: IEngine,
  baseName: string,
  versionedComponents: VersionedComponent[],
) {
  const latestComponentVersion = versionedComponents[versionedComponents.length - 1];

  console.log(`[MIGRATION] component: ${baseName}`);
  console.log(`[MIGRATION] target version: ${latestComponentVersion.versionName}`);

  // Filter components that match the baseName pattern (excluding target)
  const componentsToMigrate = [...engine.componentsIter()].filter(c => {
    const isComponentVersion =
      c.componentName === baseName || c.componentName.startsWith(`${baseName}-v`);
    return isComponentVersion && c.componentName !== latestComponentVersion.versionName;
  });

  console.log(
    `[MIGRATION] Versions to migrate to latest: ${componentsToMigrate.map(c => c.componentName)}`,
  );

  for (const component of componentsToMigrate) {
    const oldComponent = component as LastWriteWinElementSetComponentDefinition<unknown>;
    const entities = [...engine.getEntitiesWith(oldComponent)];

    console.log(`[MIGRATION] Entities with ${component.componentName}: ${entities.length}`);

    if (entities.length === 0) continue;

    const targetComponent = engine.getComponent(
      latestComponentVersion.versionName,
    ) as LastWriteWinElementSetComponentDefinition<unknown>;

    for (const [entity, value] of entities) {
      console.log(
        `[MIGRATION] Migrating entity ${entity} from ${component.componentName} to ${latestComponentVersion.versionName}`,
      );
      console.log('[MIGRATION] Old value:', value);
      oldComponent.deleteFrom(entity);
      targetComponent.createOrReplace(entity, { ...value });
    }
  }
  console.log('[MIGRATION] Finished');
}

export function migrateAllAssetPacksComponents(engine: IEngine) {
  Object.entries(VERSIONS_REGISTRY).forEach(([baseName, versions]) => {
    migrateVersionedComponent(engine, baseName, versions);
  });
}
