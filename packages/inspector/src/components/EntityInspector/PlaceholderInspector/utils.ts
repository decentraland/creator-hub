import type { TreeNode } from '../../ProjectAssetExplorer/ProjectView';
import { isAssetNode } from '../../ProjectAssetExplorer/utils';
import type { AssetNodeItem } from '../../ProjectAssetExplorer/types';
import type { AssetCatalogResponse } from '../../../tooling-entrypoint';
import type { EntityValidator } from '../../../lib/sdk/validation/types';
import type { PlaceholderInput } from './types';

export const fromPlaceholder = (value: { src: string }): PlaceholderInput => {
  return { ...value };
};

export const toPlaceholder = (value: PlaceholderInput): { src: string } => {
  return { ...value };
};

export function isValidInput({ assets }: AssetCatalogResponse, src: string): boolean {
  if (!src) return true;
  return !!assets.find($ => src === $.path);
}

export const entityValidator: EntityValidator = (sdk, entity, assetCatalog) => {
  const placeholder = sdk.components.Placeholder.getOrNull(entity);
  if (placeholder && assetCatalog && !isValidInput(assetCatalog, placeholder.src)) return false;
  return true;
};

const isAsset = (value: string): boolean => value.endsWith('.gltf') || value.endsWith('.glb');

export const isModel = (node: TreeNode): node is AssetNodeItem =>
  isAssetNode(node) && isAsset(node.name);
