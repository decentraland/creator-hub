import type { PBLightSource } from '@dcl/ecs';
import { toColor3, toHex } from '../../ui/ColorField/utils';
import type { LightInput } from './types';
import { LightKind } from './types';

export const isValidInput = (input: LightInput) => {
  const intensity = Number(input.intensity);
  if (isNaN(intensity)) return false;
  if (intensity < 0) return false;
  if (input.type === LightKind.SPOT) {
    const ia = Number(input.spot?.innerAngle ?? 0);
    const oa = Number(input.spot?.outerAngle ?? 0);
    if (isNaN(ia) || isNaN(oa)) return false;
    if (ia < 0 || ia > 180 || oa < 0 || oa > 180) return false;
  }
  return true;
};

export const fromComponent = (value: PBLightSource): LightInput => {
  const base: LightInput = {
    type: value.type?.$case === 'spot' ? LightKind.SPOT : LightKind.POINT,
    active: value.active === undefined ? true : !!value.active,
    color: toHex(value.color).toUpperCase(),
    intensity: String(value.intensity ?? 16000),
    shadow: !!value.shadow,
    shadowMaskSrc:
      value.shadowMaskTexture?.tex?.$case === 'texture'
        ? value.shadowMaskTexture.tex.texture.src
        : '',
    range: String(value.range ?? -1),
  };

  if (value.type?.$case === 'spot') {
    base.spot = {
      innerAngle: String(value.type.spot.innerAngle ?? 30),
      outerAngle: String(value.type.spot.outerAngle ?? 40),
    };
  }

  return base;
};

export const toComponent = (input: LightInput): PBLightSource => {
  const isSpot = input.type === LightKind.SPOT;
  const type = isSpot
    ? {
        $case: 'spot',
        spot: {
          innerAngle: Number(input.spot?.innerAngle || 30),
          outerAngle: Number(input.spot?.outerAngle || 40),
        },
      }
    : { $case: 'point', point: {} };

  const shadowMaskTexture =
    input.shadowMaskSrc && input.shadowMaskSrc.length > 0
      ? {
          tex: {
            $case: 'texture',
            texture: {
              src: input.shadowMaskSrc,
            },
          },
        }
      : undefined;

  return {
    type,
    active: !!input.active,
    color: toColor3(input.color),
    intensity: Number(input.intensity || 0),
    shadow: !!input.shadow,
    range: input.range && input.range.length > 0 ? Number(input.range) : undefined,
    shadowMaskTexture,
  } as PBLightSource;
};
