import type { IEngine, ISchema, LastWriteWinElementSetComponentDefinition } from '@dcl/ecs';
import type { MapResult } from '@dcl/ecs/dist/schemas/Map';

export type VersionedComponent = {
  versionName: string;
  component: Record<string, ISchema>;
};

type SchemaRegistry = Record<string, readonly Record<string, ISchema>[]>;

type MergeAll<T extends readonly any[]> = T extends readonly [infer First, ...infer Rest]
  ? First & MergeAll<Rest>
  : {}; // eslint-disable-line @typescript-eslint/ban-types

type MergedSchema<T extends readonly any[]> =
  MergeAll<T> extends Record<string, any> ? MapResult<MergeAll<T>> : never;

export type VersionedComponents<T extends SchemaRegistry> = {
  [K in keyof T]: LastWriteWinElementSetComponentDefinition<MergedSchema<T[K]>>;
};

export function createComponentFramework<T extends SchemaRegistry>(registry: T) {
  const VERSIONS_REGISTRY: Record<string, VersionedComponent[]> = Object.fromEntries(
    Object.entries(registry).map(([baseName, diffs]) => {
      const versions: VersionedComponent[] = [];
      let merged: Record<string, ISchema> = {};
      for (let i = 0; i < diffs.length; i++) {
        merged = { ...merged, ...diffs[i] };
        versions.push({
          versionName: i === 0 ? baseName : `${baseName}-v${i}`,
          component: { ...merged },
        });
      }
      return [baseName, versions];
    }),
  );

  function getLatestVersionName(baseName: string): string {
    const versions = VERSIONS_REGISTRY[baseName];
    if (!versions || versions.length === 0) {
      throw new Error(`No versions found for component: ${baseName}`);
    }
    return versions[versions.length - 1].versionName;
  }

  function defineAllComponents(engine: IEngine): Record<string, any> {
    const components: Record<string, any> = {};
    for (const [baseName, versions] of Object.entries(VERSIONS_REGISTRY)) {
      for (const v of versions) {
        engine.defineComponent(v.versionName, v.component);
      }
      const latest = versions[versions.length - 1];
      components[baseName] = engine.getComponent(latest.versionName);
    }
    return components;
  }

  function migrateAll(engine: IEngine) {
    for (const [baseName, versions] of Object.entries(VERSIONS_REGISTRY)) {
      migrateVersionedComponent(engine, baseName, versions);
    }
  }

  return {
    VERSIONS_REGISTRY,
    getLatestVersionName,
    defineAllComponents,
    migrateAll,
  };
}

export function migrateVersionedComponent(
  engine: IEngine,
  baseName: string,
  versionedComponents: VersionedComponent[],
) {
  const latestComponentVersion = versionedComponents[versionedComponents.length - 1];

  console.log(`[MIGRATION] component: ${baseName}`);
  console.log(`[MIGRATION] target version: ${latestComponentVersion.versionName}`);

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
