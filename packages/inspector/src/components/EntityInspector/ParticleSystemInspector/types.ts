import type { Entity } from '@dcl/ecs';

import type { TextureInput } from '../MaterialInspector/Texture/types';

export enum ShapeType {
  POINT = 0,
  SPHERE = 1,
  CONE = 2,
  BOX = 3,
}

export const SHAPE_TYPE_OPTIONS = [
  { label: 'Point', value: String(ShapeType.POINT) },
  { label: 'Sphere', value: String(ShapeType.SPHERE) },
  { label: 'Cone', value: String(ShapeType.CONE) },
  { label: 'Box', value: String(ShapeType.BOX) },
];

export enum BlendMode {
  PSB_ALPHA = 0,
  PSB_ADD = 1,
  PSB_MULTIPLY = 2,
}

export const BLEND_MODE_OPTIONS = [
  { label: 'Alpha', value: String(BlendMode.PSB_ALPHA) },
  { label: 'Additive', value: String(BlendMode.PSB_ADD) },
  { label: 'Multiply', value: String(BlendMode.PSB_MULTIPLY) },
];

export enum PlaybackState {
  PS_PLAYING = 0,
  PS_PAUSED = 1,
  PS_STOPPED = 2,
}

export const PLAYBACK_STATE_OPTIONS = [
  { label: 'Playing', value: String(PlaybackState.PS_PLAYING) },
  { label: 'Paused', value: String(PlaybackState.PS_PAUSED) },
  { label: 'Stopped', value: String(PlaybackState.PS_STOPPED) },
];

export enum SimulationSpace {
  PSS_LOCAL = 0,
  PSS_WORLD = 1,
}

export const SIMULATION_SPACE_OPTIONS = [
  { label: 'Local', value: String(SimulationSpace.PSS_LOCAL) },
  { label: 'World', value: String(SimulationSpace.PSS_WORLD) },
];

export type ParticleSystemInput = {
  active: boolean;
  rate: string;
  maxParticles: string;
  lifetime: string;
  gravity: string;
  additionalForce: { x: string; y: string; z: string };
  initialSize: { min: string; max: string };
  sizeOverTime: { min: string; max: string };
  faceTravelDirection: boolean;
  initialColor: { from: string; fromAlpha: string; to: string; toAlpha: string };
  colorOverTime: { from: string; fromAlpha: string; to: string; toAlpha: string };
  initialVelocitySpeed: { min: string; max: string };
  textureEnabled: boolean;
  texture: TextureInput;
  blendMode: string;
  billboard: boolean;
  spriteSheetEnabled: boolean;
  spriteSheet: { tilesX: string; tilesY: string; framesPerSecond: string };
  shapeType: string;
  sphere: { radius: string };
  cone: { angle: string; radius: string };
  box: { x: string; y: string; z: string };
  loop: boolean;
  prewarm: boolean;
  simulationSpace: string;
  limitVelocity: { speed: string; dampen: string };
  playbackState: string;
};

export type Props = { entities: Entity[]; initialOpen?: boolean };
