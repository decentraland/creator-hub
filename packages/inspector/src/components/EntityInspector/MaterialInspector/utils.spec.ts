import type { PBMaterial, PBMaterial_PbrMaterial, PBMaterial_UnlitMaterial } from '@dcl/ecs';
import type { MaterialInput } from './types';
import { MaterialType } from './types';
import { fromMaterial, toMaterial, isValidMaterial } from './utils';
import { Texture } from './Texture/types';

describe('fromMaterial', () => {
  it('should convert from unlit material', () => {
    const value: PBMaterial = {
      material: {
        $case: 'unlit' as const,
        unlit: {
          alphaTest: 0.75,
          castShadows: true,
          diffuseColor: { r: 1, b: 0, g: 0, a: 1 },
          texture: {
            tex: {
              $case: 'texture',
              texture: {
                src: 'some-src',
              },
            },
          },
        },
      },
    };

    const result = fromMaterial(value);

    expect(result.type).toBe(MaterialType.MT_UNLIT);
    expect(result.alphaTest).toBe('0.75');
    expect(result.castShadows).toBe(true);
    expect(result.diffuseColor).toEqual('#FF0000');
    expect(result.diffuseColorAlpha).toBe('1');
    expect(result.texture).toEqual({
      type: 'texture',
      src: 'some-src',
      wrapMode: '1',
      filterMode: '1',
      offset: { x: '0', y: '0' },
      tiling: { x: '1', y: '1' },
    });
  });

  it('should convert from pbr material', () => {
    const value: PBMaterial = {
      material: {
        $case: 'pbr' as const,
        pbr: {
          alphaTest: 0.6,
          castShadows: false,
          emissiveColor: { r: 1, b: 0, g: 0 },
          texture: {
            tex: {
              $case: 'texture',
              texture: {
                src: 'some-src',
              },
            },
          },
          bumpTexture: {
            tex: {
              $case: 'avatarTexture',
              avatarTexture: {
                userId: 'some-id',
                wrapMode: 2,
                filterMode: 2,
              },
            },
          },
        },
      },
    };

    const result = fromMaterial(value);

    expect(result.type).toBe(MaterialType.MT_PBR);
    expect(result.alphaTest).toBe('0.6');
    expect(result.castShadows).toBe(false);
    expect(result.texture).toEqual({
      type: 'texture',
      src: 'some-src',
      wrapMode: '1',
      filterMode: '1',
      offset: { x: '0', y: '0' },
      tiling: { x: '1', y: '1' },
    });
    expect(result.bumpTexture).toEqual({
      type: 'avatarTexture',
      userId: 'some-id',
      wrapMode: '2',
      filterMode: '2',
    });
    expect(result.metallic).toBe('0.5');
    expect(result.specularIntensity).toBe('1');
    expect(result.albedoColor).toBeUndefined();
    expect(result.albedoColorAlpha).toBe('1');
    expect(result.emissiveColor).toEqual('#FF0000');
  });

  describe('when the pbr albedo color has an alpha channel', () => {
    it('should expose the alpha through albedoColorAlpha', () => {
      const value: PBMaterial = {
        material: {
          $case: 'pbr' as const,
          pbr: {
            albedoColor: { r: 1, g: 0, b: 0, a: 0.25 },
          },
        },
      };

      const result = fromMaterial(value);

      expect(result.albedoColor).toBe('#FF0000');
      expect(result.albedoColorAlpha).toBe('0.25');
    });
  });

  describe('when the unlit diffuse color has an alpha channel', () => {
    it('should expose the alpha through diffuseColorAlpha', () => {
      const value: PBMaterial = {
        material: {
          $case: 'unlit' as const,
          unlit: {
            diffuseColor: { r: 0, g: 1, b: 0, a: 0.3 },
          },
        },
      };

      const result = fromMaterial(value);

      expect(result.diffuseColor).toBe('#00FF00');
      expect(result.diffuseColorAlpha).toBe('0.3');
    });
  });
});

describe('toMaterial', () => {
  it('should convert to unlit material', () => {
    const value: MaterialInput = {
      type: MaterialType.MT_UNLIT,
      alphaTest: '0.75',
      castShadows: true,
      diffuseColor: '#FF0000',
      texture: {
        type: Texture.TT_TEXTURE,
        src: 'some-src',
        wrapMode: '1',
        filterMode: '1',
      },
    };

    const result = toMaterial(value) as {
      material: { $case: 'unlit'; unlit: PBMaterial_UnlitMaterial };
    };

    expect(result.material.$case).toBe('unlit');
    expect(result.material.unlit.alphaTest).toBe(0.75);
    expect(result.material.unlit.castShadows).toBe(true);
    expect(result.material.unlit.diffuseColor).toStrictEqual({ r: 1, b: 0, g: 0, a: 1 });
    expect(result.material.unlit.texture).toStrictEqual({
      tex: {
        $case: 'texture',
        texture: {
          src: 'some-src',
          wrapMode: 1,
          filterMode: 1,
          offset: { x: 0, y: 0 },
          tiling: { x: 1, y: 1 },
        },
      },
    });
  });

  it('should convert to pbr material', () => {
    const value: MaterialInput = {
      type: MaterialType.MT_PBR,
      alphaTest: '0.6',
      castShadows: false,
      emissiveColor: '#FF0000',
      texture: {
        type: Texture.TT_TEXTURE,
        src: 'some-src',
        wrapMode: '1',
        filterMode: '1',
      },
      bumpTexture: {
        type: Texture.TT_AVATAR_TEXTURE,
        userId: 'some-id',
        wrapMode: '2',
        filterMode: '2',
      },
    };

    const result = toMaterial(value) as {
      material: { $case: 'pbr'; pbr: PBMaterial_PbrMaterial };
    };

    expect(result.material.$case).toBe('pbr');
    expect(result.material.pbr.alphaTest).toBe(0.6);
    expect(result.material.pbr.castShadows).toBe(false);
    expect(result.material.pbr.emissiveColor).toStrictEqual({ r: 1, b: 0, g: 0 });
    expect(result.material.pbr.texture).toStrictEqual({
      tex: {
        $case: 'texture',
        texture: {
          src: 'some-src',
          wrapMode: 1,
          filterMode: 1,
          offset: { x: 0, y: 0 },
          tiling: { x: 1, y: 1 },
        },
      },
    });
    expect(result.material.pbr.bumpTexture).toStrictEqual({
      tex: {
        $case: 'avatarTexture',
        avatarTexture: {
          userId: 'some-id',
          wrapMode: 2,
          filterMode: 2,
        },
      },
    });
  });

  describe('when the pbr numeric inputs are explicitly zero', () => {
    it('should keep the zeros instead of snapping back to the defaults', () => {
      const value: MaterialInput = {
        type: MaterialType.MT_PBR,
        alphaTest: '0',
        transparencyMode: '0',
        metallic: '0',
        roughness: '0',
        specularIntensity: '0',
        emissiveIntensity: '0',
        directIntensity: '0',
      };

      const result = toMaterial(value) as {
        material: { $case: 'pbr'; pbr: PBMaterial_PbrMaterial };
      };

      expect(result.material.pbr.alphaTest).toBe(0);
      expect(result.material.pbr.transparencyMode).toBe(0);
      expect(result.material.pbr.metallic).toBe(0);
      expect(result.material.pbr.roughness).toBe(0);
      expect(result.material.pbr.specularIntensity).toBe(0);
      expect(result.material.pbr.emissiveIntensity).toBe(0);
      expect(result.material.pbr.directIntensity).toBe(0);
    });

    it('should survive a round trip through fromMaterial', () => {
      const value: MaterialInput = {
        type: MaterialType.MT_PBR,
        transparencyMode: '0',
        metallic: '0',
        roughness: '0',
        specularIntensity: '0',
        emissiveIntensity: '0',
        directIntensity: '0',
      };

      const result = fromMaterial(toMaterial(value));

      expect(result.transparencyMode).toBe('0');
      expect(result.metallic).toBe('0');
      expect(result.roughness).toBe('0');
      expect(result.specularIntensity).toBe('0');
      expect(result.emissiveIntensity).toBe('0');
      expect(result.directIntensity).toBe('0');
    });
  });

  describe('when the pbr numeric inputs are unset or empty', () => {
    it('should fall back to the defaults', () => {
      const value: MaterialInput = {
        type: MaterialType.MT_PBR,
        metallic: '',
        roughness: '',
      };

      const result = toMaterial(value) as {
        material: { $case: 'pbr'; pbr: PBMaterial_PbrMaterial };
      };

      expect(result.material.pbr.alphaTest).toBe(0.5);
      expect(result.material.pbr.transparencyMode).toBe(4);
      expect(result.material.pbr.metallic).toBe(0.5);
      expect(result.material.pbr.roughness).toBe(0.5);
      expect(result.material.pbr.specularIntensity).toBe(1);
      expect(result.material.pbr.emissiveIntensity).toBe(0);
      expect(result.material.pbr.directIntensity).toBe(1);
    });
  });

  describe('when the pbr albedo color has an alpha input', () => {
    it('should write the alpha into albedoColor.a', () => {
      const value: MaterialInput = {
        type: MaterialType.MT_PBR,
        albedoColor: '#FF0000',
        albedoColorAlpha: '0.25',
      };

      const result = toMaterial(value) as {
        material: { $case: 'pbr'; pbr: PBMaterial_PbrMaterial };
      };

      expect(result.material.pbr.albedoColor).toEqual({ r: 1, g: 0, b: 0, a: 0.25 });
    });

    it('should keep zero alpha instead of snapping back to opaque', () => {
      const value: MaterialInput = {
        type: MaterialType.MT_PBR,
        albedoColor: '#FF0000',
        albedoColorAlpha: '0',
      };

      const result = toMaterial(value) as {
        material: { $case: 'pbr'; pbr: PBMaterial_PbrMaterial };
      };

      expect(result.material.pbr.albedoColor?.a).toBe(0);
    });

    it('should survive a round trip through fromMaterial', () => {
      const value: MaterialInput = {
        type: MaterialType.MT_PBR,
        albedoColor: '#FF0000',
        albedoColorAlpha: '0.25',
      };

      const result = fromMaterial(toMaterial(value));

      expect(result.albedoColor).toBe('#FF0000');
      expect(result.albedoColorAlpha).toBe('0.25');
    });
  });

  describe('when the pbr albedo color is an 8-digit hex', () => {
    it('should take the alpha from the hex itself', () => {
      const value: MaterialInput = {
        type: MaterialType.MT_PBR,
        albedoColor: '#FF000080',
        albedoColorAlpha: '1',
      };

      const result = toMaterial(value) as {
        material: { $case: 'pbr'; pbr: PBMaterial_PbrMaterial };
      };

      expect(result.material.pbr.albedoColor?.a).toBeCloseTo(0.5, 2);
    });
  });

  describe('when the pbr albedo alpha input is missing', () => {
    it('should keep the color opaque', () => {
      const value: MaterialInput = {
        type: MaterialType.MT_PBR,
        albedoColor: '#FF0000',
      };

      const result = toMaterial(value) as {
        material: { $case: 'pbr'; pbr: PBMaterial_PbrMaterial };
      };

      expect(result.material.pbr.albedoColor).toEqual({ r: 1, g: 0, b: 0, a: 1 });
    });
  });

  describe('when the unlit diffuse color has an alpha input', () => {
    it('should preserve the alpha through a round trip', () => {
      const value: MaterialInput = {
        type: MaterialType.MT_UNLIT,
        diffuseColor: '#00FF00',
        diffuseColorAlpha: '0.3',
      };

      const result = fromMaterial(toMaterial(value));

      expect(result.diffuseColor).toBe('#00FF00');
      expect(result.diffuseColorAlpha).toBe('0.3');
    });
  });
});

describe('isValidMaterial', () => {
  it('should return true', () => {
    const result = isValidMaterial();
    expect(result).toBe(true);
  });
});
