import { Schemas } from '@dcl/ecs';
import { BaseComponentNames } from '../base-names';

const TRANSFORM_CONFIG_BASE_NAME = BaseComponentNames.TRANSFORM_CONFIG;

const TransformConfigV0 = {
  porportionalScaling: Schemas.Optional(Schemas.Boolean),
};

export const TRANSFORM_CONFIG_VERSIONS = [
  { versionName: TRANSFORM_CONFIG_BASE_NAME, component: TransformConfigV0 },
];
