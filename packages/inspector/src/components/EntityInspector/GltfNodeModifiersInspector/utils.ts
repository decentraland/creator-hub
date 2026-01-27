import type { PBGltfNodeModifiers } from '@dcl/ecs';
import { TextureType, type MaterialInput } from '../MaterialInspector/types';
import { fromMaterial, isValidMaterial, toMaterial } from '../MaterialInspector/utils';
import type { Input, SwapInput } from './types';

function coerceSwaps(input: Input['swaps']): SwapInput[] {
  if (Array.isArray(input)) return input as SwapInput[];
  if (input && typeof input === 'object') {
    const obj = input as any;
    const keys = Object.keys(obj)
      .filter(k => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b));
    return keys.map(k => obj[k]) as SwapInput[];
  }
  return [] as SwapInput[];
}

export function ensureTextureDefaults(material: MaterialInput): MaterialInput {
  const withDefaults = { ...(material as any) } as any;

  const ensure = () => ({
    type: TextureType.TT_TEXTURE,
    src: '',
    wrapMode: '0',
    filterMode: '0',
    offset: { x: '0', y: '0' },
    tiling: { x: '1', y: '1' },
  });

  const apply = (key: string) => {
    if (!withDefaults[key]) withDefaults[key] = ensure();
    const tx = withDefaults[key];
    tx.type = tx.type ?? TextureType.TT_TEXTURE;
    tx.wrapMode = tx.wrapMode ?? '0';
    tx.filterMode = tx.filterMode ?? '0';
    tx.offset = tx.offset ?? { x: '0', y: '0' };
    tx.offset.x = tx.offset.x ?? '0';
    tx.offset.y = tx.offset.y ?? '0';
    tx.tiling = tx.tiling ?? { x: '1', y: '1' };
    tx.tiling.x = tx.tiling.x ?? '1';
    tx.tiling.y = tx.tiling.y ?? '1';
  };

  apply('texture');
  apply('alphaTexture');
  apply('bumpTexture');
  apply('emissiveTexture');

  // default castShadows for both unlit and pbr
  if (withDefaults.castShadows === undefined) {
    withDefaults.castShadows = true;
  }

  return withDefaults as MaterialInput;
}

export const fromComponent = (value: PBGltfNodeModifiers): Input => {
  return {
    swaps: (value.modifiers ?? []).map(sw => ({
      path: sw.path || '',
      castShadows: sw.castShadows === undefined ? true : !!sw.castShadows,
      material: ensureTextureDefaults(fromMaterial(sw.material as any)),
    })),
  };
};

export const toComponent = (input: Input): PBGltfNodeModifiers => {
  const swaps = coerceSwaps((input as any).swaps);
  return {
    modifiers: swaps.map(sw => ({
      path: sw.path ?? '',
      castShadows: !!sw.castShadows,
      material: toMaterial(sw.material) as any,
    })),
  } as PBGltfNodeModifiers;
};

export const isValidInput = (_input: Input) => isValidMaterial();
