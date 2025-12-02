import type { IEngine, PBMaterial, TextureUnion } from '@dcl/ecs';

export function isSelf(value: any) {
  return `${value}` === '{self}';
}

export function parseMaterial(base: string, material: PBMaterial, entityId?: number): PBMaterial {
  switch (material.material?.$case) {
    case 'unlit':
      return {
        material: {
          $case: 'unlit',
          unlit: {
            ...material.material.unlit,
            texture: parseTexture(base, material.material.unlit.texture, entityId),
          },
        },
      };
    case 'pbr':
      return {
        material: {
          $case: 'pbr',
          pbr: {
            ...material.material.pbr,
            texture: parseTexture(base, material.material.pbr.texture, entityId),
            alphaTexture: parseTexture(base, material.material.pbr.alphaTexture, entityId),
            bumpTexture: parseTexture(base, material.material.pbr.bumpTexture, entityId),
            emissiveTexture: parseTexture(base, material.material.pbr.emissiveTexture, entityId),
          },
        },
      };
  }

  return material;
}

export function parseTexture(
  base: string,
  texture?: TextureUnion,
  entityId?: number,
): TextureUnion | undefined {
  if (texture?.tex?.$case === 'texture') {
    return {
      tex: {
        $case: 'texture',
        texture: {
          ...texture.tex.texture,
          src: texture.tex.texture.src.replace('{assetPath}', base),
        },
      },
    };
  }

  if (texture?.tex?.$case === 'videoTexture' && entityId !== undefined) {
    const videoPlayerEntity = texture.tex.videoTexture.videoPlayerEntity;
    if (isSelf(videoPlayerEntity)) {
      return {
        tex: {
          $case: 'videoTexture',
          videoTexture: {
            ...texture.tex.videoTexture,
            videoPlayerEntity: entityId,
          },
        },
      };
    }
  }

  return texture;
}

export function parseSyncComponents(engine: IEngine, componentNames: string[]): number[] {
  return componentNames.reduce((acc: number[], $) => {
    // try/catch it since the component might not exist in engine...
    try {
      const component = engine.getComponent($);
      return [...acc, component.componentId];
    } catch (e) {
      console.error(`Component ${$} does not exist in engine`);
      return acc;
    }
  }, []);
}
