import type { PBGltfContainer } from '@dcl/ecs';
import { ColliderLayer } from '@dcl/ecs';

import { toNumber, toString } from '../utils';
import type { TreeNode } from '../../ProjectAssetExplorer/ProjectView';
import { isAssetNode } from '../../ProjectAssetExplorer/utils';
import type { AssetNodeItem } from '../../ProjectAssetExplorer/types';
import type { AssetCatalogResponse } from '../../../tooling-entrypoint';
import type { GltfContainerInput } from './types';

export const fromGltf = (value: PBGltfContainer): GltfContainerInput => {
  return {
    ...value,
    visibleMeshesCollisionMask: toString(value.visibleMeshesCollisionMask, ColliderLayer.CL_NONE),
    invisibleMeshesCollisionMask: toString(
      value.invisibleMeshesCollisionMask,
      ColliderLayer.CL_PHYSICS,
    ),
  };
};

export const toGltf = (value: GltfContainerInput): PBGltfContainer => {
  return {
    ...value,
    visibleMeshesCollisionMask: toNumber(value.visibleMeshesCollisionMask, ColliderLayer.CL_NONE),
    invisibleMeshesCollisionMask: toNumber(
      value.invisibleMeshesCollisionMask,
      ColliderLayer.CL_PHYSICS,
    ),
  };
};

export function isValidInput({ assets }: AssetCatalogResponse, src: string): boolean {
  if (!src) return true;
  return !!assets.find($ => src === $.path);
}

export const isAsset = (value: string): boolean =>
  value.endsWith('.gltf') || value.endsWith('.glb');
export const isModel = (node: TreeNode): node is AssetNodeItem =>
  isAssetNode(node) && isAsset(node.name);

export const COLLISION_LAYERS = [
  {
    value: ColliderLayer.CL_NONE,
    label: 'None',
  },
  {
    value: ColliderLayer.CL_POINTER,
    label: 'Pointer',
  },
  {
    value: ColliderLayer.CL_PHYSICS,
    label: 'Physics',
  },
  {
    value: ColliderLayer.CL_PHYSICS | ColliderLayer.CL_POINTER,
    label: 'Physics and Pointer',
  },
  {
    value: ColliderLayer.CL_CUSTOM1,
    label: 'Custom 1',
  },
  {
    value: ColliderLayer.CL_CUSTOM2,
    label: 'Custom 2',
  },
  {
    value: ColliderLayer.CL_CUSTOM3,
    label: 'Custom 3',
  },
  {
    value: ColliderLayer.CL_CUSTOM4,
    label: 'Custom 4',
  },
  {
    value: ColliderLayer.CL_CUSTOM5,
    label: 'Custom 5',
  },
  {
    value: ColliderLayer.CL_CUSTOM6,
    label: 'Custom 6',
  },
  {
    value: ColliderLayer.CL_CUSTOM7,
    label: 'Custom 7',
  },
  {
    value: ColliderLayer.CL_CUSTOM8,
    label: 'Custom 8',
  },
];
