import type { VersionedComponent } from '@dcl/asset-packs';
import { NODES_VERSIONS } from './definitions/nodes';
import { TRANSFORM_CONFIG_VERSIONS } from './definitions/transform-config';

export const BaseComponentNames = {
  NODES: 'inspector::Nodes',
  TRANSFORM_CONFIG: 'inspector::TransformConfig',
} as const;

export const VERSIONS_REGISTRY: Record<string, VersionedComponent[]> = {
  [BaseComponentNames.NODES]: NODES_VERSIONS,
  [BaseComponentNames.TRANSFORM_CONFIG]: TRANSFORM_CONFIG_VERSIONS,
};

export const getLatestVersionName = (baseName: string) => {
  const versions = VERSIONS_REGISTRY[baseName];
  return versions[versions.length - 1].versionName;
};
