import type { PBLightSource } from '@dcl/ecs';
import { toColor3, toHex } from '../../ui/ColorField/utils';
import type { LightInput } from './types';
import { LightKind } from './types';

const DEFAULT_INTENSITY = 16000;
const DEFAULT_INNER_ANGLE = 30;
const DEFAULT_OUTER_ANGLE = 40;

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
    intensity: String(value.intensity ?? DEFAULT_INTENSITY),
    shadow: !!value.shadow,
    shadowMaskSrc:
      value.shadowMaskTexture?.tex?.$case === 'texture'
        ? value.shadowMaskTexture.tex.texture.src
        : '',
    range: String(value.range ?? -1),
  };

  if (value.type?.$case === 'spot') {
    base.spot = {
      innerAngle: String(value.type.spot.innerAngle ?? DEFAULT_INNER_ANGLE),
      outerAngle: String(value.type.spot.outerAngle ?? DEFAULT_OUTER_ANGLE),
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
          innerAngle: Number(input.spot?.innerAngle ?? DEFAULT_INNER_ANGLE),
          outerAngle: Number(input.spot?.outerAngle ?? DEFAULT_OUTER_ANGLE),
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
    intensity: Number(input.intensity ?? DEFAULT_INTENSITY),
    shadow: !!input.shadow,
    range: Number(input.range ?? -1),
    shadowMaskTexture,
  } as PBLightSource;
};
