import { Schemas } from '@dcl/ecs';
import type { IEngine } from '@dcl/ecs';
import { BaseComponentNames } from '../constants';

const TRANSFORM_CONFIG_BASE_NAME = BaseComponentNames.TRANSFORM_CONFIG;

const TransformConfigV0 = {
  porportionalScaling: Schemas.Optional(Schemas.Boolean),
};

export const TRANSFORM_CONFIG_VERSIONS = [
  { versionName: TRANSFORM_CONFIG_BASE_NAME, component: TransformConfigV0 },
];

export function defineTransformConfigComponent(engine: IEngine) {
  return engine.defineComponent(TRANSFORM_CONFIG_BASE_NAME, TransformConfigV0);
}
