import type { Entity, PBMaterial, TextureUnion } from '@dcl/ecs';

/**
 * Replaces entity ID with '{self}' in videoTexture if it matches the provided entityId
 */
export const replaceVideoTextureEntity = (
  texture: TextureUnion | undefined,
  entityId: Entity,
): TextureUnion | undefined => {
  if (!texture?.tex) return texture;

  if (
    texture.tex.$case === 'videoTexture' &&
    texture.tex.videoTexture.videoPlayerEntity === entityId
  ) {
    return {
      tex: {
        $case: 'videoTexture',
        videoTexture: {
          ...texture.tex.videoTexture,
          videoPlayerEntity: '{self}' as unknown as number,
        },
      },
    };
  }

  return texture;
};

/**
 * Processes material textures to replace entity references with '{self}'
 * This is the inverse operation of parseMaterial in add-asset/utils.ts
 */
export const processMaterialTextures = (material: PBMaterial, entityId: Entity): PBMaterial => {
  if (!material.material) return material;

  const materialCase = material.material.$case;

  if (materialCase === 'unlit') {
    const unlitMaterial = material.material.unlit;
    return {
      material: {
        $case: 'unlit',
        unlit: {
          ...unlitMaterial,
          texture: replaceVideoTextureEntity(unlitMaterial.texture, entityId),
        },
      },
    };
  }

  if (materialCase === 'pbr') {
    const pbrMaterial = material.material.pbr;
    return {
      material: {
        $case: 'pbr',
        pbr: {
          ...pbrMaterial,
          texture: replaceVideoTextureEntity(pbrMaterial.texture, entityId),
          alphaTexture: replaceVideoTextureEntity(pbrMaterial.alphaTexture, entityId),
          emissiveTexture: replaceVideoTextureEntity(pbrMaterial.emissiveTexture, entityId),
          bumpTexture: replaceVideoTextureEntity(pbrMaterial.bumpTexture, entityId),
        },
      },
    };
  }

  return material;
};
