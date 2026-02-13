import type { VersionedComponent } from '@dcl/asset-packs';
import type { IEngine, LastWriteWinElementSetComponentDefinition } from '@dcl/ecs';
import type { MapResult } from '@dcl/ecs/dist/schemas/Map';
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
import { SCENE_METADATA_VERSIONS } from './definitions/scene-metadata';

export { BaseComponentNames };

function createVersionedComponents<T extends readonly any[]>(
  baseName: string,
  schemas: T,
): VersionedComponent[] {
  return schemas.map((schema, index) => ({
    versionName: index === 0 ? baseName : `${baseName}-v${index}`,
    component: schema,
  }));
}

type LastSchema<T extends readonly any[]> = T extends readonly [...any[], infer Last]
  ? Last extends Record<string, any>
    ? MapResult<Last>
    : never
  : never;

const VERSIONS_REGISTRY_RAW = {
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
  [BaseComponentNames.SCENE_METADATA]: SCENE_METADATA_VERSIONS,
} as const;

/**
 * Runtime versions registry converted from simplified format to full VersionedComponent format.
 * Version names are automatically generated based on array index.
 */
export const VERSIONS_REGISTRY: Record<string, VersionedComponent[]> = Object.fromEntries(
  Object.entries(VERSIONS_REGISTRY_RAW).map(([baseName, schemas]) => [
    baseName,
    createVersionedComponents(baseName, schemas),
  ]),
);

export type InspectorVersionedComponents = {
  [K in keyof typeof VERSIONS_REGISTRY_RAW]: LastWriteWinElementSetComponentDefinition<
    LastSchema<(typeof VERSIONS_REGISTRY_RAW)[K]>
  >;
};

export const getLatestVersionName = (baseName: string) => {
  const versions = VERSIONS_REGISTRY[baseName];
  return versions[versions.length - 1].versionName;
};

export function defineAllVersionedComponents(engine: IEngine): InspectorVersionedComponents {
  const components: Record<string, any> = {};

  Object.entries(VERSIONS_REGISTRY).forEach(([baseName, versions]) => {
    // Define all versions (necessary for migrations to work)
    versions.forEach(v => {
      engine.defineComponent(v.versionName, v.component);
    });

    // Get the last version (the one we use normally)
    const lastVersion = versions[versions.length - 1];
    components[baseName] = engine.defineComponent(lastVersion.versionName, lastVersion.component);
  });

  return components as InspectorVersionedComponents;
}
