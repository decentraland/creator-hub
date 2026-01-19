import type { ISchema } from '@dcl/ecs';
import { type IEngine, Schemas } from '@dcl/ecs';

// Base names (string literal para evitar dependencia circular con enums.ts)
const COUNTER_BASE_NAME = 'asset-packs::Counter';

//Counter versioned definitions
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

// export function migrateVersionedComponent(
//   engine: IEngine,
//   versionedComponents: VersionedComponent[],
// ) {
//   const latestVersion = versionedComponents[versionedComponents.length - 1];

//   // Buscar versiones viejas que tengan datos
//   for (let i = versionedComponents.length - 2; i >= 0; i--) {
//     // Excluye la última
//     const { versionName } = versionedComponents[i];
//     const OldComponent = engine.getComponentOrNull(versionName);

//     if (!OldComponent) continue;

//     // Obtener TODAS las entities que tienen este componente viejo
//     for (const [entity, value] of engine.getEntitiesWith(OldComponent)) {
//       // 1. Guardar el valor
//       const oldValue = { ...value };

//       // 2. Borrar del componente viejo
//       OldComponent.deleteFrom(entity);

//       // 3. Crear en el componente nuevo (con migración si es necesario)
//       const NewComponent = engine.getComponent(latestVersion.versionName);
//       const migratedValue = latestVersion.migrate ? latestVersion.migrate(oldValue) : oldValue;
//       NewComponent.create(entity, migratedValue);
//     }

//     // 4. Eliminar la definición del componente viejo
//     engine.removeComponentDefinition(versionName);
//   }
// }
