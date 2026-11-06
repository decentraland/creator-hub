import type { DeepReadonlyObject, Entity, IEngine } from '@dcl/ecs';
import type { AdminTools } from '../definitions';
import { getComponents } from '../definitions';

// `rewardsControl` is left out: nothing reads it, and the scripted Admin Tools no longer passes it.
type AdminConfigInput = Omit<AdminTools, 'rewardsControl'>;
type AdminConfig = DeepReadonlyObject<AdminConfigInput>;

// The Admin Toolkit UI reads its configuration through this single funnel, which supports two
// sources:
//   - the SCRIPT path: the `AdminTools.tsx` smart-item script injects its params-derived config
//     (and its own entity) via `setAdminConfig` before mounting the UI. There is no
//     `asset-packs::AdminTools` component in this case.
//   - the LEGACY path: older scenes carry a serialized `asset-packs::AdminTools` component, read
//     straight from the engine. `setAdminConfig` is never called, so the injected values stay
//     undefined and the component wins.
// This assumes a single admin item per scene, which the legacy `getEntitiesWith(AdminTools)[0]`
// lookup already assumed.
let injectedConfig: AdminConfig | undefined;
let injectedEntity: Entity | undefined;

export function setAdminConfig(config: AdminConfigInput, entity: Entity) {
  injectedConfig = config;
  injectedEntity = entity;
}

/** Drops the config `entity` injected, e.g. when its Admin Tools item is removed. */
export function clearAdminConfig(entity: Entity) {
  if (injectedEntity !== entity) return;
  injectedConfig = undefined;
  injectedEntity = undefined;
}

export function getAdminConfigOrNull(engine: IEngine): AdminConfig | null {
  if (injectedConfig) return injectedConfig;
  const { AdminTools } = getComponents(engine);
  const entities = Array.from(engine.getEntitiesWith(AdminTools));
  return entities.length > 0 ? entities[0][1] : null;
}

export function getAdminConfig(engine: IEngine): AdminConfig {
  const config = getAdminConfigOrNull(engine);
  if (!config) throw new Error('[admin-toolkit] no admin configuration available');
  return config;
}

export function getAdminEntityOrNull(engine: IEngine): Entity | null {
  if (injectedEntity !== undefined) return injectedEntity;
  const { AdminTools } = getComponents(engine);
  const entities = Array.from(engine.getEntitiesWith(AdminTools));
  return entities.length > 0 ? entities[0][0] : null;
}
