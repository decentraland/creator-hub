import type { Entity } from '@dcl/ecs';
import { TextureFilterMode, TextureWrapMode } from '@dcl/ecs';

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

export const WRAP_MODE_OPTIONS = [
  { label: 'Repeat', value: String(TextureWrapMode.TWM_REPEAT) },
  { label: 'Clamp', value: String(TextureWrapMode.TWM_CLAMP) },
  { label: 'Mirror', value: String(TextureWrapMode.TWM_MIRROR) },
];

export const FILTER_MODE_OPTIONS = [
  { label: 'Point', value: String(TextureFilterMode.TFM_POINT) },
  { label: 'Bilinear', value: String(TextureFilterMode.TFM_BILINEAR) },
  { label: 'Trilinear', value: String(TextureFilterMode.TFM_TRILINEAR) },
];

// Engine defaults for unset texture modes (used for display only; unset values stay unset).
export const DEFAULT_WRAP_MODE = String(TextureWrapMode.TWM_CLAMP);
export const DEFAULT_FILTER_MODE = String(TextureFilterMode.TFM_BILINEAR);

export type EulerInput = { x: string; y: string; z: string };

export type TextureInput = {
  src: string;
  // Empty string means "unset" (engine default); the value only gets written when the user sets it.
  wrapMode: string;
  filterMode: string;
  offset: { x: string; y: string };
  tiling: { x: string; y: string };
};

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
  initialRotation: EulerInput;
  rotationOverTime: EulerInput;
  faceTravelDirection: boolean;
  initialColor: { startColor: string; startAlpha: string; endColor: string; endAlpha: string };
  colorOverTime: { startColor: string; startAlpha: string; endColor: string; endAlpha: string };
  initialVelocitySpeed: { start: string; end: string };
  textureEnabled: boolean;
  texture: TextureInput;
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
