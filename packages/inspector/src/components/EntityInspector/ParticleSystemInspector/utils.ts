import { Quaternion } from '@babylonjs/core';

import type {
  ParticleSystemBurst,
  ParticleSystemComponentType,
  ParticleSystemShape,
  ParticleSystemTexture,
} from '../../../lib/sdk/components/ParticleSystem';
import { toHex, toColor3 } from '../../ui/ColorField/utils';
import type { ParticleSystemInput, BurstInput, EulerInput, TextureInput } from './types';
import { ShapeType } from './types';

type QuaternionType = { x: number; y: number; z: number; w: number };

const formatDegrees = (radians: number): string =>
  String(Math.round(((radians * 180) / Math.PI) * 100) / 100);

const fromQuaternion = (value: QuaternionType | undefined): EulerInput => {
  if (!value) return { x: '0', y: '0', z: '0' };
  const angles = new Quaternion(value.x, value.y, value.z, value.w).toEulerAngles();
  return {
    x: formatDegrees(angles.x),
    y: formatDegrees(angles.y),
    z: formatDegrees(angles.z),
  };
};

export const eulerDegreesToQuaternion = (euler: EulerInput): QuaternionType => {
  const quaternion = Quaternion.RotationYawPitchRoll(
    (Number(euler.y) * Math.PI) / 180,
    (Number(euler.x) * Math.PI) / 180,
    (Number(euler.z) * Math.PI) / 180,
  );
  return { x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w };
};

// Zero rotation maps to "unset" so an untouched editor never materializes the field.
const toQuaternion = (euler: EulerInput): QuaternionType | undefined => {
  const isZero = Number(euler.x) === 0 && Number(euler.y) === 0 && Number(euler.z) === 0;
  return isZero ? undefined : eulerDegreesToQuaternion(euler);
};

const fromTexture = (texture: ParticleSystemTexture | undefined): TextureInput => ({
  src: texture?.src ?? '',
  wrapMode: texture?.wrapMode !== undefined ? String(texture.wrapMode) : '',
  filterMode: texture?.filterMode !== undefined ? String(texture.filterMode) : '',
  offset: {
    x: texture?.offset !== undefined ? String(texture.offset.x) : '',
    y: texture?.offset !== undefined ? String(texture.offset.y) : '',
  },
  tiling: {
    x: texture?.tiling !== undefined ? String(texture.tiling.x) : '',
    y: texture?.tiling !== undefined ? String(texture.tiling.y) : '',
  },
});

const toVector2 = (
  value: { x: string; y: string },
  defaultValue: number,
): { x: number; y: number } | undefined => {
  if (value.x === '' && value.y === '') return undefined;
  return {
    x: value.x === '' ? defaultValue : Number(value.x),
    y: value.y === '' ? defaultValue : Number(value.y),
  };
};

// Fields the user never set stay unset instead of materializing values
// (engine defaults are Clamp / Bilinear / offset {0,0} / tiling {1,1}).
const toTexture = (input: TextureInput): ParticleSystemTexture => ({
  src: input.src ?? '',
  wrapMode: input.wrapMode === '' ? undefined : Number(input.wrapMode),
  filterMode: input.filterMode === '' ? undefined : Number(input.filterMode),
  offset: toVector2(input.offset, 0),
  tiling: toVector2(input.tiling, 1),
});

const fromShape = (shape: ParticleSystemShape | undefined) => {
  const sphere = shape?.$case === 'sphere' ? shape.sphere : undefined;
  const cone = shape?.$case === 'cone' ? shape.cone : undefined;
  const box = shape?.$case === 'box' ? shape.box?.size : undefined;
  return {
    shapeType: (shape?.$case ?? ShapeType.POINT) as ShapeType,
    sphere: { radius: String(sphere?.radius ?? 1) },
    cone: {
      angle: String(cone?.angle ?? 25),
      radius: String(cone?.radius ?? 1),
    },
    box: {
      x: String(box?.x ?? 1),
      y: String(box?.y ?? 1),
      z: String(box?.z ?? 1),
    },
  };
};

const toShape = (input: ParticleSystemInput): ParticleSystemShape => {
  switch (input.shapeType) {
    case ShapeType.SPHERE:
      return {
        $case: 'sphere',
        sphere: { radius: Number(input.sphere.radius) },
      };
    case ShapeType.CONE:
      return {
        $case: 'cone',
        cone: { angle: Number(input.cone.angle), radius: Number(input.cone.radius) },
      };
    case ShapeType.BOX:
      return {
        $case: 'box',
        box: {
          size: {
            x: Number(input.box.x),
            y: Number(input.box.y),
            z: Number(input.box.z),
          },
        },
      };
    case ShapeType.POINT:
    default:
      return { $case: 'point', point: {} };
  }
};

const fromBurst = (burst: ParticleSystemBurst): BurstInput => ({
  time: String(burst.time ?? 0),
  count: String(burst.count ?? 0),
  cycles: String(burst.cycles ?? 1),
  interval: String(burst.interval ?? 0.01),
  probability: String(burst.probability ?? 1),
});

const toBurst = (input: BurstInput): ParticleSystemBurst => ({
  time: Number(input.time),
  count: Number(input.count),
  cycles: Number(input.cycles),
  interval: Number(input.interval),
  probability: Number(input.probability),
});

export const createDefaultBurst = (): BurstInput => ({
  time: '0',
  count: '10',
  cycles: '1',
  interval: '0.01',
  probability: '1',
});

export const fromComponent = (value: ParticleSystemComponentType): ParticleSystemInput => ({
  active: value.active ?? true,
  rate: String(value.rate ?? 10),
  maxParticles: String(value.maxParticles ?? 1000),
  lifetime: String(value.lifetime ?? 5),
  gravity: String(value.gravity ?? 0),
  additionalForce: {
    x: String(value.additionalForce?.x ?? 0),
    y: String(value.additionalForce?.y ?? 0),
    z: String(value.additionalForce?.z ?? 0),
  },
  initialSize: {
    start: String(value.initialSize?.start ?? 1),
    end: String(value.initialSize?.end ?? 1),
  },
  sizeOverTime: {
    start: String(value.sizeOverTime?.start ?? 1),
    end: String(value.sizeOverTime?.end ?? 1),
  },
  initialRotation: fromQuaternion(value.initialRotation),
  rotationOverTime: fromQuaternion(value.rotationOverTime),
  faceTravelDirection: value.faceTravelDirection ?? false,
  initialColor: {
    startColor: toHex(value.initialColor?.start).toUpperCase(),
    startAlpha: String(value.initialColor?.start?.a ?? 1),
    endColor: toHex(value.initialColor?.end).toUpperCase(),
    endAlpha: String(value.initialColor?.end?.a ?? 1),
  },
  colorOverTime: {
    startColor: toHex(value.colorOverTime?.start).toUpperCase(),
    startAlpha: String(value.colorOverTime?.start?.a ?? 1),
    endColor: toHex(value.colorOverTime?.end).toUpperCase(),
    endAlpha: String(value.colorOverTime?.end?.a ?? 1),
  },
  initialVelocitySpeed: {
    start: String(value.initialVelocitySpeed?.start ?? 1),
    end: String(value.initialVelocitySpeed?.end ?? 1),
  },
  textureEnabled: !!value.texture,
  texture: fromTexture(value.texture),
  blendMode: String(value.blendMode ?? 0),
  billboard: value.billboard ?? true,
  spriteSheetEnabled: !!value.spriteSheet,
  spriteSheet: {
    tilesX: String(value.spriteSheet?.tilesX ?? 1),
    tilesY: String(value.spriteSheet?.tilesY ?? 1),
    framesPerSecond: String(value.spriteSheet?.framesPerSecond ?? 30),
  },
  ...fromShape(value.shape),
  loop: value.loop ?? true,
  prewarm: value.prewarm ?? false,
  simulationSpace: String(value.simulationSpace ?? 0),
  limitVelocityEnabled: !!value.limitVelocity,
  limitVelocity: {
    speed: String(value.limitVelocity?.speed ?? 5),
    dampen: String(value.limitVelocity?.dampen ?? 1),
  },
  playbackState: String(value.playbackState ?? 0),
  bursts: (value.bursts?.values ?? []).map(fromBurst),
});

export const toComponent = (input: ParticleSystemInput): ParticleSystemComponentType => {
  const startColor = toColor3(input.initialColor.startColor);
  const endColor = toColor3(input.initialColor.endColor);
  const cotStartColor = toColor3(input.colorOverTime.startColor);
  const cotEndColor = toColor3(input.colorOverTime.endColor);

  const component: ParticleSystemComponentType = {
    active: input.active,
    rate: Number(input.rate),
    maxParticles: Number(input.maxParticles),
    lifetime: Number(input.lifetime),
    gravity: Number(input.gravity),
    additionalForce: {
      x: Number(input.additionalForce.x),
      y: Number(input.additionalForce.y),
      z: Number(input.additionalForce.z),
    },
    initialSize: {
      start: Number(input.initialSize.start),
      end: Number(input.initialSize.end),
    },
    sizeOverTime: {
      start: Number(input.sizeOverTime.start),
      end: Number(input.sizeOverTime.end),
    },
    initialRotation: toQuaternion(input.initialRotation),
    rotationOverTime: toQuaternion(input.rotationOverTime),
    faceTravelDirection: input.faceTravelDirection,
    initialColor: {
      start: { ...startColor, a: Number(input.initialColor.startAlpha) },
      end: { ...endColor, a: Number(input.initialColor.endAlpha) },
    },
    colorOverTime: {
      start: { ...cotStartColor, a: Number(input.colorOverTime.startAlpha) },
      end: { ...cotEndColor, a: Number(input.colorOverTime.endAlpha) },
    },
    initialVelocitySpeed: {
      start: Number(input.initialVelocitySpeed.start),
      end: Number(input.initialVelocitySpeed.end),
    },
    // Explicit undefined (not a missing key) so disabling the texture actually removes it
    // when the save path spread-merges over the current component value.
    texture: input.textureEnabled ? toTexture(input.texture) : undefined,
    blendMode: Number(input.blendMode),
    billboard: input.billboard,
    spriteSheet: input.spriteSheetEnabled
      ? {
          tilesX: Number(input.spriteSheet.tilesX),
          tilesY: Number(input.spriteSheet.tilesY),
          framesPerSecond: Number(input.spriteSheet.framesPerSecond),
        }
      : undefined,
    shape: toShape(input),
    loop: input.loop,
    prewarm: input.prewarm,
    simulationSpace: Number(input.simulationSpace),
    limitVelocity: input.limitVelocityEnabled
      ? {
          speed: Number(input.limitVelocity.speed),
          dampen: Number(input.limitVelocity.dampen),
        }
      : undefined,
    playbackState: Number(input.playbackState),
    bursts: input.bursts.length > 0 ? { values: input.bursts.map(toBurst) } : undefined,
  };

  return component;
};

export const isValidInput = (input: ParticleSystemInput): boolean => {
  const rate = Number(input.rate);
  const maxParticles = Number(input.maxParticles);
  const lifetime = Number(input.lifetime);
  if (isNaN(rate) || isNaN(maxParticles) || isNaN(lifetime)) return false;
  if (rate < 0 || maxParticles < 0 || lifetime < 0) return false;
  for (const burst of input.bursts) {
    const time = Number(burst.time);
    const count = Number(burst.count);
    if (isNaN(time) || isNaN(count) || time < 0 || count < 0) return false;
  }
  for (const euler of [input.initialRotation, input.rotationOverTime]) {
    if (isNaN(Number(euler.x)) || isNaN(Number(euler.y)) || isNaN(Number(euler.z))) return false;
  }
  if (input.textureEnabled) {
    for (const vector of [input.texture.offset, input.texture.tiling]) {
      if (vector.x !== '' && isNaN(Number(vector.x))) return false;
      if (vector.y !== '' && isNaN(Number(vector.y))) return false;
    }
  }
  return true;
};
