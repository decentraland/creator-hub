import { Schemas } from '@dcl/ecs';

const TransformConfigV0 = { porportionalScaling: Schemas.Optional(Schemas.Boolean) };

export const TRANSFORM_CONFIG_VERSIONS = [TransformConfigV0] as const;
