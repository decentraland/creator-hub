import type { Material } from '@babylonjs/core';
import { Texture } from '@babylonjs/core';
import { Limits, type Metrics } from './types';

export function getSceneLimits(parcels: number): Metrics {
  return {
    triangles: parcels * Limits.triangles,
    entities: parcels * Limits.entities,
    bodies: parcels * Limits.bodies,
    materials: Math.floor(Math.log2(parcels + 1) * Limits.materials),
    textures: Math.floor(Math.log2(parcels + 1) * Limits.textures),
  };
}

/**
 * Extracts textures from a material and adds them to the textures set.
 * Materials can have multiple texture properties (albedoTexture, normalTexture, etc.)
 */
export function collectTexturesFromMaterial(
  material: Material,
  texturesSet: Set<string>,
  ignoreTextures: string[],
): void {
  for (const key in material) {
    const value = (material as any)[key];
    if (value && typeof value === 'object' && 'getInternalTexture' in value) {
      // This is a texture
      const texture = value;
      if (ignoreTextures.includes(texture.name)) continue;

      const isTexture = texture instanceof Texture;
      const url = isTexture ? (texture as Texture).url : texture.name || '';

      // Filter out editor-generated data URIs
      if (url && url.startsWith('data:') && url.includes('EnvironmentBRDFTexture')) continue;

      // Use URL as primary key for deduplication
      if (url) {
        texturesSet.add(url);
      } else {
        const internalTexture = texture.getInternalTexture();
        if (internalTexture?.uniqueId != null) {
          texturesSet.add(`__uniqueId_${internalTexture.uniqueId}`);
        }
      }
    }
  }
}
