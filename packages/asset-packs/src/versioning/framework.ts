import type {
  IEngine,
  ISchema,
  JsonSchemaExtended,
  LastWriteWinElementSetComponentDefinition,
} from '@dcl/ecs';
import { Schemas } from '@dcl/ecs';
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

function mergeMapProperties(targetProps: any, sourceProps: any): any {
  const result = { ...targetProps };
  for (const [key, sourceProp] of Object.entries(sourceProps)) {
    const targetProp = targetProps[key];
    if (
      targetProp?.serializationType === 'map' &&
      (sourceProp as any)?.serializationType === 'map'
    ) {
      result[key] = {
        ...(sourceProp as any),
        properties: mergeMapProperties(
          targetProp.properties || {},
          (sourceProp as any).properties || {},
        ),
      };
    } else {
      result[key] = sourceProp;
    }
  }
  return result;
}

function deepMergeSchemas(
  target: Record<string, any>,
  source: Record<string, any>,
): Record<string, any> {
  const result = { ...target };

  for (const [key, sourceValue] of Object.entries(source)) {
    const targetValue = target[key];

    if (!(key in target)) {
      result[key] = sourceValue;
    } else if (
      targetValue?.jsonSchema?.serializationType === 'map' &&
      sourceValue?.jsonSchema?.serializationType === 'map'
    ) {
      const mergedProps = mergeMapProperties(
        (targetValue.jsonSchema as any).properties || {},
        (sourceValue.jsonSchema as any).properties || {},
      );

      const spec: Record<string, ISchema> = {};
      for (const [k, v] of Object.entries(mergedProps)) {
        spec[k] = Schemas.fromJson(v as JsonSchemaExtended);
      }
      result[key] = Schemas.Map(spec);
    } else if (
      targetValue?.jsonSchema?.serializationType === 'optional' &&
      sourceValue?.jsonSchema?.serializationType === 'optional'
    ) {
      const targetInner = (targetValue.jsonSchema as any).optionalJsonSchema;
      const sourceInner = (sourceValue.jsonSchema as any).optionalJsonSchema;

      if (targetInner?.serializationType === 'map' && sourceInner?.serializationType === 'map') {
        const mergedProps = mergeMapProperties(
          targetInner.properties || {},
          sourceInner.properties || {},
        );
        const spec: Record<string, ISchema> = {};
        for (const [k, v] of Object.entries(mergedProps)) {
          spec[k] = Schemas.fromJson(v as JsonSchemaExtended);
        }
        result[key] = Schemas.Optional(Schemas.Map(spec));
      } else if (
        targetInner?.serializationType === 'array' &&
        sourceInner?.serializationType === 'array'
      ) {
        const targetItems = targetInner.items;
        const sourceItems = sourceInner.items;

        if (targetItems?.serializationType === 'map' && sourceItems?.serializationType === 'map') {
          const mergedProps = mergeMapProperties(
            targetItems.properties || {},
            sourceItems.properties || {},
          );
          const spec: Record<string, ISchema> = {};
          for (const [k, v] of Object.entries(mergedProps)) {
            spec[k] = Schemas.fromJson(v as JsonSchemaExtended);
          }
          result[key] = Schemas.Optional(Schemas.Array(Schemas.Map(spec)));
        } else {
          result[key] = sourceValue;
        }
      } else {
        result[key] = sourceValue;
      }
    } else {
      result[key] = sourceValue;
    }
  }

  return result;
}

export function createComponentFramework<T extends SchemaRegistry>(registry: T) {
  const VERSIONS_REGISTRY: Record<string, VersionedComponent[]> = Object.fromEntries(
    Object.entries(registry).map(([baseName, diffs]) => {
      const versions: VersionedComponent[] = [];
      let merged: Record<string, ISchema> = {};
      for (let i = 0; i < diffs.length; i++) {
        merged = deepMergeSchemas(merged, diffs[i]);
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
