import { Schemas } from '@dcl/ecs';
import type { IEngine } from '@dcl/ecs';
import { BaseComponentNames } from '../base-names';

const HIDE_BASE_NAME = BaseComponentNames.HIDE;

const HideV0 = {
  value: Schemas.Boolean,
};

export const HIDE_VERSIONS = [{ versionName: HIDE_BASE_NAME, component: HideV0 }];

export function defineHideComponent(engine: IEngine) {
  return engine.defineComponent(HIDE_BASE_NAME, HideV0);
}
