import type { ISchema, LastWriteWinElementSetComponentDefinition } from '@dcl/ecs';
import type { IEngine } from '@dcl/ecs';
import {
  COUNTER_VERSIONS,
  TRIGGERS_VERSIONS,
  defineCounterComponent,
  defineTriggersComponent,
} from './definitions';

export type VersionedComponent = {
  versionName: string;
  component: Record<string, ISchema>;
};

const VERSIONS_REGISTRY: Record<string, VersionedComponent[]> = {
  'asset-packs::Counter': COUNTER_VERSIONS,
  'asset-packs::Triggers': TRIGGERS_VERSIONS,
};

export const getLatestVersionName = (baseName: string) => {
  const versions = VERSIONS_REGISTRY[baseName];
  return versions[versions.length - 1].versionName;
};

export function migrateVersionedComponent(
  engine: IEngine,
  versionedComponents: VersionedComponent[],
) {
  const latestVersion = versionedComponents[versionedComponents.length - 1];

  for (let i = 0; i < versionedComponents.length - 1; i++) {
    const oldVersion = versionedComponents[i];

    const oldComponent = engine.getComponentOrNull(
      oldVersion.versionName,
    ) as LastWriteWinElementSetComponentDefinition<unknown> | null;

    if (!oldComponent) continue;

    const entities = [...engine.getEntitiesWith(oldComponent)];
    if (entities.length === 0) continue;

    const newComponent = engine.getComponent(
      latestVersion.versionName,
    ) as LastWriteWinElementSetComponentDefinition<unknown>;

    for (const [entity, value] of entities) {
      oldComponent.deleteFrom(entity);
      newComponent.createOrReplace(entity, { ...value });
    }

    engine.removeComponentDefinition(oldVersion.versionName);
  }
}

//TOOD move to definitions
export function defineAssetPacksComponents(engine: IEngine) {
  const Counter = defineCounterComponent(engine);
  const Triggers = defineTriggersComponent(engine);

  return { Counter, Triggers };
}

export function migrateAllAssetPacksComponents(engine: IEngine) {
  migrateVersionedComponent(engine, COUNTER_VERSIONS);
  migrateVersionedComponent(engine, TRIGGERS_VERSIONS);
}
