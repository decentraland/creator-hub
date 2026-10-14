import { Filter } from './Filters/types';
import type { TreeNode } from './ProjectView';
import type { AssetNode, AssetNodeFolder, AssetNodeItem, IAsset } from './types';

export function AssetNodeRootNull(): AssetNodeFolder {
  return { name: '', parent: null, type: 'folder', children: [] };
}

const validModelExtensions = ['.gltf', '.glb'];
const validAudioExtensions = ['.mp3', '.ogg', '.wav'];
const validImageExtensions = ['.jpg', '.jpeg', '.png'];
const validVideoExtensions = ['.mp4'];
const validScriptExtensions = ['.ts', '.tsx'];

function determineAssetType(extension: string): IAsset['type'] {
  return validModelExtensions.some(ext => extension.endsWith(ext))
    ? 'gltf'
    : validAudioExtensions.some(ext => extension.endsWith(ext))
      ? 'audio'
      : validImageExtensions.some(ext => extension.endsWith(ext))
        ? 'image'
        : validVideoExtensions.some(ext => extension.endsWith(ext))
          ? 'video'
          : validScriptExtensions.some(ext => extension.endsWith(ext))
            ? 'script'
            : 'unknown';
}

export function buildAssetTree(paths: string[]): AssetNodeFolder {
  const root: AssetNodeFolder = AssetNodeRootNull();

  for (const path of paths) {
    const parts = path.split('/').filter(item => item.length > 0);
    let currentNode = root;

    for (let i = 0; i < parts.length; i++) {
      let childNode = currentNode.children.find(child => child.name === parts[i]);
      if (!childNode) {
        // it's not the last level
        if (i < parts.length - 1) {
          childNode = { name: parts[i], parent: currentNode, type: 'folder', children: [] };
          currentNode.children.push(childNode);
          currentNode = childNode;
        } else {
          const lowerPath = path.toLowerCase();
          const assetType = determineAssetType(lowerPath);
          childNode = {
            name: parts[i],
            parent: currentNode,
            type: 'asset',
            asset: {
              src: path,
              type: assetType,
            },
          };
          currentNode.children.push(childNode);
        }
      } else if (childNode.type === 'folder') {
        currentNode = childNode;
      } else {
        throw new Error('Impossible condition');
      }
    }
  }

  return root;
}

export function getFullNodePath(item: AssetNode | TreeNode): string {
  let path = '';
  let it: AssetNode | TreeNode | null = item;
  while (it && it.name) {
    path = '/' + it.name + path;
    it = it.parent;
  }
  return path;
}

export function isAssetNode(node: AssetNode | TreeNode): node is AssetNodeItem {
  return node.type === 'asset';
}

export const DEFAULT_FILTERS: Filter[] = [Filter.All /* Filter.Recents */];
export const FILTERS_IN_ORDER: Filter[] = [
  Filter.Models,
  Filter.Emotes,
  Filter.Images,
  Filter.Audio,
  Filter.Video,
  Filter.Scripts,
  Filter.Other,
];

// Avatar animations are plain GLBs; the `_emote` suffix (which the import dialog appends to any
// model it detects as an emote) is what tells them apart from scene models.
export function isEmoteAsset(asset: IAsset): boolean {
  return asset.type === 'gltf' && /_emote\.(glb|gltf)$/i.test(asset.src);
}

export function mapAssetTypeToFilter(asset: IAsset): Filter | undefined {
  switch (asset.type) {
    case 'gltf':
      return isEmoteAsset(asset) ? Filter.Emotes : Filter.Models;
    case 'audio':
      return Filter.Audio;
    case 'image':
      return Filter.Images;
    case 'video':
      return Filter.Video;
    case 'script':
      return Filter.Scripts;
    default:
      return Filter.Other;
  }
}

export function getFilterFromTree(filters: Set<Filter>): Filter[] {
  return [...DEFAULT_FILTERS, ...FILTERS_IN_ORDER.filter($ => filters.has($))];
}
