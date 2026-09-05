import type { PBMaterial } from '@dcl/ecs';
import { MaterialTransparencyMode } from '@dcl/ecs';

import { toColor3OrUndefined, toColor4, toHexOrUndefined } from '../../ui/ColorField/utils';
import { mapSelectFieldOptions } from '../../ui/Dropdown/utils';
import { toString } from '../utils';
import { fromTexture, toTexture, toNumberOrDefault } from './Texture/utils';
import type { MaterialInput } from './types';
import { MaterialType } from './types';

// the hex color picker is RGB-only, so the alpha channel is carried through the
// input separately and reapplied here (same approach as TextShapeInspector)
const toColor4WithAlphaOrUndefined = (
  hex?: string,
  alpha?: string,
): ReturnType<typeof toColor4> | undefined => {
  if (!hex) return undefined;
  const color = toColor4(hex);
  // an 8-digit hex (#RRGGBBAA) already carries its own alpha
  if (hex.length > 7) return color;
  const parsedAlpha = alpha === undefined || alpha === '' ? NaN : Number(alpha);
  return { ...color, a: isNaN(parsedAlpha) ? color.a : parsedAlpha };
};

export const fromMaterial = (value: PBMaterial): MaterialInput => {
  switch (value.material?.$case) {
    case 'unlit':
      return {
        type: MaterialType.MT_UNLIT,
        alphaTest: String(value.material.unlit.alphaTest ?? 0.5),
        castShadows: !!(value.material.unlit.castShadows ?? true),
        diffuseColor: toHexOrUndefined(value.material.unlit.diffuseColor),
        diffuseColorAlpha: toString(value.material.unlit.diffuseColor?.a ?? 1),
        texture: fromTexture(value.material.unlit.texture ?? {}),
        alphaTexture: fromTexture(value.material.unlit.alphaTexture ?? {}),
      };
    case 'pbr':
    default:
      return {
        type: MaterialType.MT_PBR,
        alphaTest: String(value.material?.pbr.alphaTest ?? 0.5),
        castShadows: !!(value.material?.pbr.castShadows ?? true),
        transparencyMode: toString(
          value.material?.pbr.transparencyMode,
          MaterialTransparencyMode.MTM_AUTO,
        ),
        metallic: toString(value.material?.pbr.metallic ?? 0.5),
        roughness: toString(value.material?.pbr.roughness ?? 0.5),
        specularIntensity: toString(value.material?.pbr.specularIntensity ?? 1),
        emissiveIntensity: toString(value.material?.pbr.emissiveIntensity ?? 0),
        directIntensity: toString(value.material?.pbr.directIntensity ?? 1),
        albedoColor: toHexOrUndefined(value.material?.pbr.albedoColor),
        albedoColorAlpha: toString(value.material?.pbr.albedoColor?.a ?? 1),
        emissiveColor: toHexOrUndefined(value.material?.pbr.emissiveColor),
        reflectivityColor: toHexOrUndefined(value.material?.pbr.reflectivityColor),
        texture: fromTexture(value.material?.pbr.texture ?? {}),
        alphaTexture: fromTexture(value.material?.pbr.alphaTexture ?? {}),
        bumpTexture: fromTexture(value.material?.pbr.bumpTexture ?? {}),
        emissiveTexture: fromTexture(value.material?.pbr.emissiveTexture ?? {}),
      };
  }
};

export const toMaterial = (value: MaterialInput): PBMaterial => {
  switch (value.type) {
    case MaterialType.MT_UNLIT:
      return {
        material: {
          $case: 'unlit',
          unlit: {
            alphaTest: toNumberOrDefault(value.alphaTest, 0.5),
            castShadows: !!(value.castShadows ?? true),
            diffuseColor: toColor4WithAlphaOrUndefined(value.diffuseColor, value.diffuseColorAlpha),
            texture: toTexture(value.texture),
            alphaTexture: toTexture(value.alphaTexture),
          },
        },
      };
    case MaterialType.MT_PBR:
    default:
      return {
        material: {
          $case: 'pbr',
          pbr: {
            alphaTest: toNumberOrDefault(value.alphaTest, 0.5),
            castShadows: !!(value.castShadows ?? true),
            transparencyMode: toNumberOrDefault(
              value.transparencyMode,
              MaterialTransparencyMode.MTM_AUTO,
            ),
            metallic: toNumberOrDefault(value.metallic, 0.5),
            roughness: toNumberOrDefault(value.roughness, 0.5),
            specularIntensity: toNumberOrDefault(value.specularIntensity, 1),
            emissiveIntensity: toNumberOrDefault(value.emissiveIntensity, 0),
            directIntensity: toNumberOrDefault(value.directIntensity, 1),
            albedoColor: toColor4WithAlphaOrUndefined(value.albedoColor, value.albedoColorAlpha),
            emissiveColor: toColor3OrUndefined(value.emissiveColor),
            reflectivityColor: toColor3OrUndefined(value.reflectivityColor),
            texture: toTexture(value.texture),
            alphaTexture: toTexture(value.alphaTexture),
            bumpTexture: toTexture(value.bumpTexture),
            emissiveTexture: toTexture(value.emissiveTexture),
          },
        },
      };
  }
};

export function isValidMaterial(): boolean {
  return true;
}

export const MATERIAL_TYPES = mapSelectFieldOptions(MaterialType);

export const TRANSPARENCY_MODES = [
  {
    value: 0,
    label: 'Opaque',
  },
  {
    value: 1,
    label: 'Alpha test',
  },
  {
    value: 2,
    label: 'Alpha blend',
  },
  {
    value: 3,
    label: 'Alpha test & blend',
  },
  {
    value: 4,
    label: 'Auto',
  },
];
