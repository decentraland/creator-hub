import { Schemas } from '@dcl/ecs';

export const PARTICLE_SYSTEM_COMPONENT_ID = 1217;

export const ParticleSystemSchema = Object.assign(
  Schemas.Map({
    // Emission
    active: Schemas.Optional(Schemas.Boolean),
    rate: Schemas.Optional(Schemas.Float),
    maxParticles: Schemas.Optional(Schemas.Int),
    lifetime: Schemas.Optional(Schemas.Float),

    // Motion
    gravity: Schemas.Optional(Schemas.Float),
    additionalForce: Schemas.Optional(Schemas.Vector3),

    // Size
    initialSize: Schemas.Optional(Schemas.Map({ min: Schemas.Float, max: Schemas.Float })),
    sizeOverTime: Schemas.Optional(Schemas.Map({ min: Schemas.Float, max: Schemas.Float })),

    // Rotation
    initialRotation: Schemas.Optional(Schemas.Quaternion),
    rotationOverTime: Schemas.Optional(Schemas.Quaternion),
    faceTravelDirection: Schemas.Optional(Schemas.Boolean),

    // Color
    initialColor: Schemas.Optional(
      Schemas.Map({
        from: Schemas.Color4,
        to: Schemas.Color4,
      }),
    ),
    colorOverTime: Schemas.Optional(
      Schemas.Map({
        from: Schemas.Color4,
        to: Schemas.Color4,
      }),
    ),

    // Velocity
    initialVelocitySpeed: Schemas.Optional(Schemas.Map({ min: Schemas.Float, max: Schemas.Float })),

    // Rendering
    textureSrc: Schemas.Optional(Schemas.String),
    blendMode: Schemas.Optional(Schemas.Int),
    billboard: Schemas.Optional(Schemas.Boolean),

    // Sprite Sheet
    spriteSheet: Schemas.Optional(
      Schemas.Map({
        tilesX: Schemas.Int,
        tilesY: Schemas.Int,
        framesPerSecond: Schemas.Optional(Schemas.Float),
      }),
    ),

    // Shape (flattened from proto oneof)
    // 0 = Point, 1 = Sphere, 2 = Cone, 3 = Box
    shapeType: Schemas.Optional(Schemas.Int),
    sphereRadius: Schemas.Optional(Schemas.Float),
    coneAngle: Schemas.Optional(Schemas.Float),
    coneRadius: Schemas.Optional(Schemas.Float),
    boxSize: Schemas.Optional(Schemas.Vector3),

    // Simulation
    loop: Schemas.Optional(Schemas.Boolean),
    prewarm: Schemas.Optional(Schemas.Boolean),
    simulationSpace: Schemas.Optional(Schemas.Int),

    // Limit Velocity
    limitVelocitySpeed: Schemas.Optional(Schemas.Float),
    limitVelocityDampen: Schemas.Optional(Schemas.Float),

    // Playback
    playbackState: Schemas.Optional(Schemas.Int),

    // Bursts
    bursts: Schemas.Optional(
      Schemas.Array(
        Schemas.Map({
          time: Schemas.Float,
          count: Schemas.Int,
          cycles: Schemas.Optional(Schemas.Int),
          interval: Schemas.Optional(Schemas.Float),
          probability: Schemas.Optional(Schemas.Float),
        }),
      ),
    ),
  }),
  { COMPONENT_ID: PARTICLE_SYSTEM_COMPONENT_ID },
);

export type ParticleSystemComponentType = {
  active?: boolean;
  rate?: number;
  maxParticles?: number;
  lifetime?: number;
  gravity?: number;
  additionalForce?: { x: number; y: number; z: number };
  initialSize?: { min: number; max: number };
  sizeOverTime?: { min: number; max: number };
  initialRotation?: { x: number; y: number; z: number; w: number };
  rotationOverTime?: { x: number; y: number; z: number; w: number };
  faceTravelDirection?: boolean;
  initialColor?: {
    from: { r: number; g: number; b: number; a: number };
    to: { r: number; g: number; b: number; a: number };
  };
  colorOverTime?: {
    from: { r: number; g: number; b: number; a: number };
    to: { r: number; g: number; b: number; a: number };
  };
  initialVelocitySpeed?: { min: number; max: number };
  textureSrc?: string;
  blendMode?: number;
  billboard?: boolean;
  spriteSheet?: { tilesX: number; tilesY: number; framesPerSecond?: number };
  shapeType?: number;
  sphereRadius?: number;
  coneAngle?: number;
  coneRadius?: number;
  boxSize?: { x: number; y: number; z: number };
  loop?: boolean;
  prewarm?: boolean;
  simulationSpace?: number;
  limitVelocitySpeed?: number;
  limitVelocityDampen?: number;
  playbackState?: number;
  bursts?: Array<{
    time: number;
    count: number;
    cycles?: number;
    interval?: number;
    probability?: number;
  }>;
};
