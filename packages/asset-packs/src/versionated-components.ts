import type { ISchema, LastWriteWinElementSetComponentDefinition } from '@dcl/ecs';
import { type IEngine, Schemas } from '@dcl/ecs';

const COUNTER_BASE_NAME = 'asset-packs::Counter';

const Counter = COUNTER_BASE_NAME;

const CounterV0 = {
  id: Schemas.Number,
  value: Schemas.Int,
};

const CounterV1 = {
  id: Schemas.Number,
  value: Schemas.Int,
  random: Schemas.Boolean,
};

export const COUNTER_VERSIONS = [
  { versionName: Counter, component: CounterV0 },
  { versionName: `${Counter}-v1`, component: CounterV1 },
];

//Helpers
type VersionedComponent = {
  versionName: string;
  component: Record<string, ISchema>;
};

export function getLatestComponentVersion(versionedComponents: VersionedComponent[]) {
  return versionedComponents[versionedComponents.length - 1];
}

export function defineVersionedComponents(
  engine: IEngine,
  versionedComponents: VersionedComponent[],
) {
  const components = versionedComponents.map(({ versionName, component }) => {
    return engine.defineComponent(versionName, component);
  });

  return components;
}

export function removeOldComponentVersions(
  engine: IEngine,
  versionedComponents: VersionedComponent[],
  currentComponentVersion: string,
) {
  versionedComponents.forEach(({ versionName }) => {
    if (versionName !== currentComponentVersion) {
      engine.removeComponentDefinition(versionName);
    }
  });
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
