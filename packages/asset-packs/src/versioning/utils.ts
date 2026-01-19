import type { ISchema, LastWriteWinElementSetComponentDefinition } from '@dcl/ecs';
import type { IEngine } from '@dcl/ecs';
import { COUNTER_VERSIONS } from './components';

export type VersionedComponent = {
  versionName: string;
  component: Record<string, ISchema>;
};

export const AssetPacksComponentsVersions = {
  Counter: COUNTER_VERSIONS,
  // Actions: ACTIONS_VERSIONS,
  // Triggers: TRIGGERS_VERSIONS,
} as const;

export function getLatestComponentVersion(versionedComponents: VersionedComponent[]) {
  return versionedComponents[versionedComponents.length - 1];
}

function defineComponentVersions(engine: IEngine, versionedComponents: VersionedComponent[]) {
  const components = versionedComponents.map(({ versionName, component }) => {
    return engine.defineComponent(versionName, component);
  });

  return components;
}

export function getCompositeComponentVersion(
  engine: IEngine,
  versionedComponents: VersionedComponent[],
) {
  for (let i = versionedComponents.length - 1; i >= 0; i--) {
    const { versionName } = versionedComponents[i];

    const component = engine.getComponentOrNull(
      versionName,
    ) as LastWriteWinElementSetComponentDefinition<unknown> | null;

    if (!component) continue;

    const entities = [...engine.getEntitiesWith(component)];
    if (entities.length === 0) continue;

    return {
      versionIndex: i,
      versionName,
      component,
      entities,
    };
  }

  return null;
}

export function migrateVersionedComponent(
  engine: IEngine,
  versionedComponents: VersionedComponent[],
) {
  const latestVersion = getLatestComponentVersion(versionedComponents);
  const found = getCompositeComponentVersion(engine, versionedComponents);

  if (!found) return;
  if (found.versionName === latestVersion.versionName) return;

  const NewComponent = engine.getComponent(
    latestVersion.versionName,
  ) as LastWriteWinElementSetComponentDefinition<unknown>;

  for (const [entity, value] of found.entities) {
    const oldValue = { ...value };
    found.component.deleteFrom(entity);
    NewComponent.createOrReplace(entity, oldValue);
  }

  engine.removeComponentDefinition(found.versionName);
}

export function defineAssetPacksComponents(engine: IEngine) {
  const Counter = defineComponentVersions(engine, AssetPacksComponentsVersions.Counter).pop()!;
  // const Actions = defineComponentVersions(engine, AssetPacksComponentsVersions.Actions).pop()!;
  // const Triggers = defineComponentVersions(engine, AssetPacksComponentsVersions.Triggers).pop()!;

  return { Counter };
}
