import type { Entity } from '@dcl/ecs';

export enum ShapeType {
  POINT = 'point',
  SPHERE = 'sphere',
  CONE = 'cone',
  BOX = 'box',
}

export const SHAPE_TYPE_OPTIONS = [
  { label: 'Point', value: ShapeType.POINT },
  { label: 'Sphere', value: ShapeType.SPHERE },
  { label: 'Cone', value: ShapeType.CONE },
  { label: 'Box', value: ShapeType.BOX },
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

export type BurstInput = {
  time: string;
  count: string;
  cycles: string;
  interval: string;
  probability: string;
};

export type ParticleSystemInput = {
  active: boolean;
  rate: string;
  maxParticles: string;
  lifetime: string;
  gravity: string;
  additionalForce: { x: string; y: string; z: string };
  initialSize: { start: string; end: string };
  sizeOverTime: { start: string; end: string };
  faceTravelDirection: boolean;
  initialColor: { startColor: string; startAlpha: string; endColor: string; endAlpha: string };
  colorOverTime: { startColor: string; startAlpha: string; endColor: string; endAlpha: string };
  initialVelocitySpeed: { start: string; end: string };
  textureEnabled: boolean;
  texture: { src: string };
  blendMode: string;
  billboard: boolean;
  spriteSheetEnabled: boolean;
  spriteSheet: { tilesX: string; tilesY: string; framesPerSecond: string };
  shapeType: ShapeType;
  sphere: { radius: string };
  cone: { angle: string; radius: string };
  box: { x: string; y: string; z: string };
  loop: boolean;
  prewarm: boolean;
  simulationSpace: string;
  limitVelocityEnabled: boolean;
  limitVelocity: { speed: string; dampen: string };
  playbackState: string;
  bursts: BurstInput[];
};

export type Props = { entities: Entity[]; initialOpen?: boolean };
