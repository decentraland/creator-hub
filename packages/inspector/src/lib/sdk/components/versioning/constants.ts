import type { VersionedComponent } from '@dcl/asset-packs';
import type { IEngine, LastWriteWinElementSetComponentDefinition } from '@dcl/ecs';
import { BaseComponentNames } from './base-names';
import { SELECTION_VERSIONS } from './definitions/selection';
import { NODES_VERSIONS } from './definitions/nodes';
import { TRANSFORM_CONFIG_VERSIONS } from './definitions/transform-config';
import { HIDE_VERSIONS } from './definitions/hide';
import { LOCK_VERSIONS } from './definitions/lock';
import { GROUND_VERSIONS } from './definitions/ground';
import { TILE_VERSIONS } from './definitions/tile';
import { CUSTOM_ASSET_VERSIONS } from './definitions/custom-asset';
import { CONFIG_VERSIONS } from './definitions/config';
import { INSPECTOR_UI_STATE_VERSIONS } from './definitions/inspector-ui-state';

export { BaseComponentNames };

export const VERSIONS_REGISTRY: Record<string, VersionedComponent[]> = {
  [BaseComponentNames.SELECTION]: SELECTION_VERSIONS,
  [BaseComponentNames.NODES]: NODES_VERSIONS,
  [BaseComponentNames.TRANSFORM_CONFIG]: TRANSFORM_CONFIG_VERSIONS,
  [BaseComponentNames.HIDE]: HIDE_VERSIONS,
  [BaseComponentNames.LOCK]: LOCK_VERSIONS,
  [BaseComponentNames.GROUND]: GROUND_VERSIONS,
  [BaseComponentNames.TILE]: TILE_VERSIONS,
  [BaseComponentNames.CUSTOM_ASSET]: CUSTOM_ASSET_VERSIONS,
  [BaseComponentNames.CONFIG]: CONFIG_VERSIONS,
  [BaseComponentNames.INSPECTOR_UI_STATE]: INSPECTOR_UI_STATE_VERSIONS,
};

export const getLatestVersionName = (baseName: string) => {
  const versions = VERSIONS_REGISTRY[baseName];
  return versions[versions.length - 1].versionName;
};

/**
 * Defines all versions of all versioned components and returns the latest version of each.
 * This function iterates over VERSIONS_REGISTRY, defines all versions (necessary for migrations),
 * and returns an object with the latest version of each component keyed by baseName.
 */
export function defineAllVersionedComponents(engine: IEngine) {
  const components: Record<string, LastWriteWinElementSetComponentDefinition<unknown>> = {};

  Object.entries(VERSIONS_REGISTRY).forEach(([baseName, versions]) => {
    // Define all versions (necessary for migrations to work)
    versions.forEach(v => {
      engine.defineComponent(v.versionName, v.component);
    });

    // Get the last version (the one we use normally)
    const lastVersion = versions[versions.length - 1];
    components[baseName] = engine.defineComponent(
      lastVersion.versionName,
      lastVersion.component,
    ) as LastWriteWinElementSetComponentDefinition<unknown>;
  });

  return components;
}
