import type { ISchema, LastWriteWinElementSetComponentDefinition } from '@dcl/ecs';
import type { IEngine } from '@dcl/ecs';
import { BaseComponentNames } from '../constants';
import { COUNTER_VERSIONS, TRIGGERS_VERSIONS } from './definitions';

export type VersionedComponent = {
  versionName: string;
  component: Record<string, ISchema>;
};

const VERSIONS_REGISTRY: Record<string, VersionedComponent[]> = {
  [BaseComponentNames.COUNTER]: COUNTER_VERSIONS,
  [BaseComponentNames.TRIGGERS]: TRIGGERS_VERSIONS,
};

export const getLatestVersionName = (baseName: string) => {
  const versions = VERSIONS_REGISTRY[baseName];
  return versions[versions.length - 1].versionName;
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
  migrateVersionedComponent(engine, BaseComponentNames.COUNTER, COUNTER_VERSIONS);
  migrateVersionedComponent(engine, BaseComponentNames.TRIGGERS, TRIGGERS_VERSIONS);
}
