import { Schemas } from '@dcl/ecs';

export const PARTICLE_SYSTEM_COMPONENT_ID = 1217;

const FloatRangeSchema = Schemas.Map({
  start: Schemas.Float,
  end: Schemas.Float,
});

const ColorRangeSchema = Schemas.Map({
  start: Schemas.Color4,
  end: Schemas.Color4,
});

const TextureSchema = Schemas.Map({
  src: Schemas.String,
  wrapMode: Schemas.Optional(Schemas.Int),
  filterMode: Schemas.Optional(Schemas.Int),
  offset: Schemas.Optional(
    Schemas.Map({
      x: Schemas.Float,
      y: Schemas.Float,
    }),
  ),
  tiling: Schemas.Optional(
    Schemas.Map({
      x: Schemas.Float,
      y: Schemas.Float,
    }),
  ),
});

const ShapePointSchema = Schemas.Map({});
const ShapeSphereSchema = Schemas.Map({
  radius: Schemas.Optional(Schemas.Float),
});
const ShapeConeSchema = Schemas.Map({
  angle: Schemas.Optional(Schemas.Float),
  radius: Schemas.Optional(Schemas.Float),
});
const ShapeBoxSchema = Schemas.Map({
  size: Schemas.Optional(Schemas.Vector3),
});

const ShapeSchema = Schemas.Map({
  $case: Schemas.String,
  point: Schemas.Optional(ShapePointSchema),
  sphere: Schemas.Optional(ShapeSphereSchema),
  cone: Schemas.Optional(ShapeConeSchema),
  box: Schemas.Optional(ShapeBoxSchema),
});

const BurstSchema = Schemas.Map({
  time: Schemas.Float,
  count: Schemas.Int,
  cycles: Schemas.Optional(Schemas.Int),
  interval: Schemas.Optional(Schemas.Float),
  probability: Schemas.Optional(Schemas.Float),
});

const BurstConfigurationSchema = Schemas.Map({
  values: Schemas.Array(BurstSchema),
});

export const ParticleSystemSchema = Object.assign(
  Schemas.Map({
    active: Schemas.Optional(Schemas.Boolean),
    rate: Schemas.Optional(Schemas.Float),
    maxParticles: Schemas.Optional(Schemas.Int),
    lifetime: Schemas.Optional(Schemas.Float),

    gravity: Schemas.Optional(Schemas.Float),
    additionalForce: Schemas.Optional(Schemas.Vector3),

    initialSize: Schemas.Optional(FloatRangeSchema),
    sizeOverTime: Schemas.Optional(FloatRangeSchema),

    initialRotation: Schemas.Optional(Schemas.Quaternion),
    rotationOverTime: Schemas.Optional(Schemas.Quaternion),
    faceTravelDirection: Schemas.Optional(Schemas.Boolean),

    initialColor: Schemas.Optional(ColorRangeSchema),
    colorOverTime: Schemas.Optional(ColorRangeSchema),

    initialVelocitySpeed: Schemas.Optional(FloatRangeSchema),

    texture: Schemas.Optional(TextureSchema),
    blendMode: Schemas.Optional(Schemas.Int),
    billboard: Schemas.Optional(Schemas.Boolean),

    spriteSheet: Schemas.Optional(
      Schemas.Map({
        tilesX: Schemas.Int,
        tilesY: Schemas.Int,
        framesPerSecond: Schemas.Optional(Schemas.Float),
      }),
    ),

    shape: Schemas.Optional(ShapeSchema),

    loop: Schemas.Optional(Schemas.Boolean),
    prewarm: Schemas.Optional(Schemas.Boolean),
    simulationSpace: Schemas.Optional(Schemas.Int),

    limitVelocity: Schemas.Optional(
      Schemas.Map({
        speed: Schemas.Float,
        dampen: Schemas.Optional(Schemas.Float),
      }),
    ),

    playbackState: Schemas.Optional(Schemas.Int),

    bursts: Schemas.Optional(BurstConfigurationSchema),
  }),
  { COMPONENT_ID: PARTICLE_SYSTEM_COMPONENT_ID },
);

export type ParticleSystemTexture = {
  src: string;
  wrapMode?: number;
  filterMode?: number;
  offset?: { x: number; y: number };
  tiling?: { x: number; y: number };
};

export type ParticleSystemShape =
  | { $case: 'point'; point: Record<string, never> }
  | { $case: 'sphere'; sphere: { radius?: number } }
  | { $case: 'cone'; cone: { angle?: number; radius?: number } }
  | { $case: 'box'; box: { size?: { x: number; y: number; z: number } } };

export type ParticleSystemBurst = {
  time: number;
  count: number;
  cycles?: number;
  interval?: number;
  probability?: number;
};

export type ParticleSystemComponentType = {
  active?: boolean;
  rate?: number;
  maxParticles?: number;
  lifetime?: number;
  gravity?: number;
  additionalForce?: { x: number; y: number; z: number };
  initialSize?: { start: number; end: number };
  sizeOverTime?: { start: number; end: number };
  initialRotation?: { x: number; y: number; z: number; w: number };
  rotationOverTime?: { x: number; y: number; z: number; w: number };
  faceTravelDirection?: boolean;
  initialColor?: {
    start: { r: number; g: number; b: number; a: number };
    end: { r: number; g: number; b: number; a: number };
  };
  colorOverTime?: {
    start: { r: number; g: number; b: number; a: number };
    end: { r: number; g: number; b: number; a: number };
  };
  initialVelocitySpeed?: { start: number; end: number };
  texture?: ParticleSystemTexture;
  blendMode?: number;
  billboard?: boolean;
  spriteSheet?: { tilesX: number; tilesY: number; framesPerSecond?: number };
  shape?: ParticleSystemShape;
  loop?: boolean;
  prewarm?: boolean;
  simulationSpace?: number;
  limitVelocity?: { speed: number; dampen?: number };
  playbackState?: number;
  bursts?: { values: ParticleSystemBurst[] };
};
