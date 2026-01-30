import type { IEngine } from '@dcl/ecs';
import { BaseComponentNames } from '../base-names';

const GROUND_BASE_NAME = BaseComponentNames.GROUND;

const GroundV0 = {};

export const GROUND_VERSIONS = [{ versionName: GROUND_BASE_NAME, component: GroundV0 }];

export function defineGroundComponent(engine: IEngine) {
  return engine.defineComponent(GROUND_BASE_NAME, GroundV0);
}
