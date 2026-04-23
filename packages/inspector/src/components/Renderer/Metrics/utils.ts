import type { Material } from '@babylonjs/core';
import { Texture } from '@babylonjs/core';
import { Limits, type Metrics } from './types';

const MEGAPIXEL = 1_000_000;

/** Per-parcel budget: one 2048x2048 texture per layer, but since all layers share the same
 * UV space and dimensions, the budget is expressed as a single number per parcel. */
export function getSceneLimits(parcels: number): Metrics {
  return {
    triangles: parcels * Limits.triangles,
    entities: parcels * Limits.entities,
    bodies: parcels * Limits.bodies,
    materials: Math.floor(Math.log2(parcels + 1) * Limits.materials),
    textures: Number.MAX_SAFE_INTEGER,
    // TODO: apply a hard cap for very large scenes once the team defines the max value
    // e.g. Math.min(parcels * Limits.texturePixels, MAX_TEXTURE_PIXELS_CAP)
    texturePixels: parcels * Limits.texturePixels,
  };
}

export interface MaterialTextureInfo {
  uniqueTextures: Set<string>;
  // Max pixel count (width × height) across all layers of this material
  maxLayerPixels: number;
}

/**
 * Extracts texture info from a material.
 * Returns the set of unique texture keys and the max pixel count across layers.
 */
export function collectTexturesFromMaterial(
  material: Material,
  ignoreTextures: string[],
): MaterialTextureInfo {
  const uniqueTextures = new Set<string>();
  let maxLayerPixels = 0;

  for (const key in material) {
    const value = (material as any)[key];
    if (value && typeof value === 'object' && 'getInternalTexture' in value) {
      const texture = value;
      if (ignoreTextures.includes(texture.name)) continue;

      const isTexture = texture instanceof Texture;
      const url = isTexture ? (texture as Texture).url : texture.name || '';

      // Filter out editor-generated data URIs
      if (url && url.startsWith('data:') && url.includes('EnvironmentBRDFTexture')) continue;

      let textureKey: string | null = null;

      if (url) {
        textureKey = url;
      } else {
        const internalTexture = texture.getInternalTexture();
        if (internalTexture?.uniqueId != null) {
          textureKey = `__uniqueId_${internalTexture.uniqueId}`;
        }
      }

      if (textureKey) {
        uniqueTextures.add(textureKey);
        const size = texture.getSize();
        const pixels = (size?.width ?? 0) * (size?.height ?? 0);
        if (pixels > maxLayerPixels) {
          maxLayerPixels = pixels;
        }
      }
    }
  }

  return { uniqueTextures, maxLayerPixels };
}

export function formatPixels(pixels: number): string {
  const mp = pixels / MEGAPIXEL;
  if (mp >= 10) return `${Math.round(mp)} MP`;
  return `${mp.toFixed(1)} MP`;
}
