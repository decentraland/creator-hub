import type { TextureUnion } from '@dcl/ecs';
import { TextureFilterMode, TextureWrapMode } from '@dcl/ecs';

import { toNumber, toString } from '../../utils';
import type { TreeNode } from '../../../ProjectAssetExplorer/ProjectView';
import type { AssetNodeItem } from '../../../ProjectAssetExplorer/types';
import { isAssetNode } from '../../../ProjectAssetExplorer/utils';
import type { AssetCatalogResponse } from '../../../../lib/data-layer/remote-data-layer';
import { isValidInput } from '../../GltfInspector/utils';
import { isValidHttpsUrl } from '../../../../lib/utils/url';
import { Texture } from './types';
import type { TextureInput } from './types';

// engine defaults for unset texture modes (see @dcl/ecs texture.gen:
// "default = TextureWrapMode.Clamp" / "default = FilterMode.Bilinear")
export const DEFAULT_WRAP_MODE = TextureWrapMode.TWM_CLAMP;
export const DEFAULT_FILTER_MODE = TextureFilterMode.TFM_BILINEAR;

// like toNumber, but also falls back to the default on undefined/empty input,
// so an explicit "0" survives while a missing value doesn't become 0
export const toNumberOrDefault = (value: string | undefined, def: number): number => {
  if (value === undefined || value === '') return def;
  const num = Number(value);
  return isNaN(num) ? def : num;
};

export const fromTexture = (value: TextureUnion): TextureInput => {
  switch (value.tex?.$case) {
    case 'avatarTexture':
      return {
        type: Texture.TT_AVATAR_TEXTURE,
        userId: toString(value.tex.avatarTexture.userId),
        wrapMode: toString(value.tex.avatarTexture.wrapMode, DEFAULT_WRAP_MODE),
        filterMode: toString(value.tex.avatarTexture.filterMode, DEFAULT_FILTER_MODE),
      };
    case 'videoTexture':
      return {
        type: Texture.TT_VIDEO_TEXTURE,
        videoPlayerEntity: toString(value.tex.videoTexture.videoPlayerEntity),
        wrapMode: toString(value.tex.videoTexture.wrapMode, DEFAULT_WRAP_MODE),
        filterMode: toString(value.tex.videoTexture.filterMode, DEFAULT_FILTER_MODE),
      };
    case 'texture':
    default: {
      const src = value?.tex?.texture.src ?? '';
      return {
        src,
        type: Texture.TT_TEXTURE,
        wrapMode: toString(value?.tex?.texture.wrapMode, DEFAULT_WRAP_MODE),
        filterMode: toString(value?.tex?.texture.filterMode, DEFAULT_FILTER_MODE),
        offset: {
          x: value?.tex?.texture.offset?.x?.toFixed(2) ?? '0',
          y: value?.tex?.texture.offset?.y?.toFixed(2) ?? '0',
        },
        tiling: {
          x: value?.tex?.texture.tiling?.x?.toFixed(2) ?? '1',
          y: value?.tex?.texture.tiling?.y?.toFixed(2) ?? '1',
        },
      };
    }
  }
};

export const toTexture = (value?: TextureInput): TextureUnion => {
  switch (value?.type) {
    case Texture.TT_AVATAR_TEXTURE:
      return {
        tex: {
          $case: 'avatarTexture',
          avatarTexture: {
            userId: toString(value.userId),
            wrapMode: toNumberOrDefault(value.wrapMode, DEFAULT_WRAP_MODE),
            filterMode: toNumberOrDefault(value.filterMode, DEFAULT_FILTER_MODE),
          },
        },
      };
    case Texture.TT_VIDEO_TEXTURE:
      return {
        tex: {
          $case: 'videoTexture',
          videoTexture: {
            videoPlayerEntity: toNumber(value.videoPlayerEntity ?? '')!,
            wrapMode: toNumberOrDefault(value.wrapMode, DEFAULT_WRAP_MODE),
            filterMode: toNumberOrDefault(value.filterMode, DEFAULT_FILTER_MODE),
          },
        },
      };
    default: {
      const src = value?.src || '';
      return {
        tex: {
          $case: 'texture',
          texture: {
            src,
            wrapMode: toNumberOrDefault(value?.wrapMode, DEFAULT_WRAP_MODE),
            filterMode: toNumberOrDefault(value?.filterMode, DEFAULT_FILTER_MODE),
            offset: {
              x: toNumber(value?.offset?.x ?? '0'),
              y: toNumber(value?.offset?.y ?? '0'),
            },
            tiling: {
              x: toNumber(value?.tiling?.x ?? '1'),
              y: toNumber(value?.tiling?.y ?? '1'),
            },
          },
        },
      };
    }
  }
};

export const isTexture = (value: string): boolean =>
  value.endsWith('.png') || value.endsWith('.jpg') || value.endsWith('.jpeg');
export const isModel = (node: TreeNode): node is AssetNodeItem =>
  isAssetNode(node) && isTexture(node.name);

export function isValidTexture(value: any, files?: AssetCatalogResponse): boolean {
  if (typeof value === 'string' && files)
    return isValidHttpsUrl(value) || isValidInput(files, value);
  return false;
}
