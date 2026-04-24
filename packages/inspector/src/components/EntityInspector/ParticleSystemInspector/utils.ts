import type { ParticleSystemComponentType } from '../../../lib/sdk/components/ParticleSystem';
import { toHex, toColor3 } from '../../ui/ColorField/utils';
import { Texture } from '../MaterialInspector/Texture/types';
import type { ParticleSystemInput } from './types';
import { ShapeType } from './types';

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
    min: String(value.initialSize?.min ?? 1),
    max: String(value.initialSize?.max ?? 1),
  },
  sizeOverTime: {
    min: String(value.sizeOverTime?.min ?? 1),
    max: String(value.sizeOverTime?.max ?? 1),
  },
  faceTravelDirection: value.faceTravelDirection ?? false,
  initialColor: {
    from: toHex(value.initialColor?.from).toUpperCase(),
    fromAlpha: String(value.initialColor?.from?.a ?? 1),
    to: toHex(value.initialColor?.to).toUpperCase(),
    toAlpha: String(value.initialColor?.to?.a ?? 1),
  },
  colorOverTime: {
    from: toHex(value.colorOverTime?.from).toUpperCase(),
    fromAlpha: String(value.colorOverTime?.from?.a ?? 1),
    to: toHex(value.colorOverTime?.to).toUpperCase(),
    toAlpha: String(value.colorOverTime?.to?.a ?? 1),
  },
  initialVelocitySpeed: {
    min: String(value.initialVelocitySpeed?.min ?? 1),
    max: String(value.initialVelocitySpeed?.max ?? 1),
  },
  textureEnabled: !!(value.textureSrc && value.textureSrc.length > 0),
  texture: {
    type: Texture.TT_TEXTURE,
    src: value.textureSrc ?? '',
    wrapMode: '0',
    filterMode: '0',
    offset: { x: '0', y: '0' },
    tiling: { x: '1', y: '1' },
  },
  blendMode: String(value.blendMode ?? 0),
  billboard: value.billboard ?? true,
  spriteSheetEnabled: !!value.spriteSheet,
  spriteSheet: {
    tilesX: String(value.spriteSheet?.tilesX ?? 1),
    tilesY: String(value.spriteSheet?.tilesY ?? 1),
    framesPerSecond: String(value.spriteSheet?.framesPerSecond ?? 30),
  },
  shapeType: String(value.shapeType ?? ShapeType.POINT),
  sphere: { radius: String(value.sphereRadius ?? 1) },
  cone: {
    angle: String(value.coneAngle ?? 25),
    radius: String(value.coneRadius ?? 1),
  },
  box: {
    x: String(value.boxSize?.x ?? 1),
    y: String(value.boxSize?.y ?? 1),
    z: String(value.boxSize?.z ?? 1),
  },
  loop: value.loop ?? true,
  prewarm: value.prewarm ?? false,
  simulationSpace: String(value.simulationSpace ?? 0),
  limitVelocity: {
    speed: String(value.limitVelocitySpeed ?? 0),
    dampen: String(value.limitVelocityDampen ?? 1),
  },
  playbackState: String(value.playbackState ?? 0),
});

export const toComponent = (input: ParticleSystemInput): ParticleSystemComponentType => {
  const fromColor = toColor3(input.initialColor.from);
  const toColor = toColor3(input.initialColor.to);
  const cotFromColor = toColor3(input.colorOverTime.from);
  const cotToColor = toColor3(input.colorOverTime.to);

  return {
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
      min: Number(input.initialSize.min),
      max: Number(input.initialSize.max),
    },
    sizeOverTime: {
      min: Number(input.sizeOverTime.min),
      max: Number(input.sizeOverTime.max),
    },
    faceTravelDirection: input.faceTravelDirection,
    initialColor: {
      from: { ...fromColor, a: Number(input.initialColor.fromAlpha) },
      to: { ...toColor, a: Number(input.initialColor.toAlpha) },
    },
    colorOverTime: {
      from: { ...cotFromColor, a: Number(input.colorOverTime.fromAlpha) },
      to: { ...cotToColor, a: Number(input.colorOverTime.toAlpha) },
    },
    initialVelocitySpeed: {
      min: Number(input.initialVelocitySpeed.min),
      max: Number(input.initialVelocitySpeed.max),
    },
    textureSrc: input.textureEnabled ? (input.texture.src ?? '') : '',
    blendMode: Number(input.blendMode),
    billboard: input.billboard,
    spriteSheet: input.spriteSheetEnabled
      ? {
          tilesX: Number(input.spriteSheet.tilesX),
          tilesY: Number(input.spriteSheet.tilesY),
          framesPerSecond: Number(input.spriteSheet.framesPerSecond),
        }
      : undefined,
    shapeType: Number(input.shapeType),
    sphereRadius: Number(input.sphere.radius),
    coneAngle: Number(input.cone.angle),
    coneRadius: Number(input.cone.radius),
    boxSize: {
      x: Number(input.box.x),
      y: Number(input.box.y),
      z: Number(input.box.z),
    },
    loop: input.loop,
    prewarm: input.prewarm,
    simulationSpace: Number(input.simulationSpace),
    limitVelocitySpeed: Number(input.limitVelocity.speed),
    limitVelocityDampen: Number(input.limitVelocity.dampen),
    playbackState: Number(input.playbackState),
  };
};

export const isValidInput = (input: ParticleSystemInput): boolean => {
  const rate = Number(input.rate);
  const maxParticles = Number(input.maxParticles);
  const lifetime = Number(input.lifetime);
  if (isNaN(rate) || isNaN(maxParticles) || isNaN(lifetime)) return false;
  if (rate < 0 || maxParticles < 0 || lifetime < 0) return false;
  return true;
};
