import { Schemas } from '@dcl/ecs';

export const TRANSFORM_CONFIG_VERSIONS = [
  { porportionalScaling: Schemas.Optional(Schemas.Boolean) },
] as const;
