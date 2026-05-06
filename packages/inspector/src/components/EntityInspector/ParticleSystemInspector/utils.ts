import type {
  ParticleSystemBurst,
  ParticleSystemComponentType,
  ParticleSystemShape,
} from '../../../lib/sdk/components/ParticleSystem';
import { toHex, toColor3 } from '../../ui/ColorField/utils';
import type { ParticleSystemInput, BurstInput } from './types';
import { ShapeType } from './types';

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
  texture: { src: value.texture?.src ?? '' },
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

  if (input.textureEnabled) {
    component.texture = { src: input.texture.src ?? '' };
  }

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
  return true;
};
