import type { CompressionSettings } from './types';

const TEXTURE_TYPE_KEYS: Record<string, keyof CompressionSettings> = {
  baseColor: 'basecolorSize',
  normal: 'normalSize',
  orm: 'ormSize',
  emissive: 'emissiveSize',
  other: 'otherSize',
};

export function getMaxHeight(type: string, settings: CompressionSettings): number {
  const key = TEXTURE_TYPE_KEYS[type] || 'otherSize';
  return settings[key] as number;
}
