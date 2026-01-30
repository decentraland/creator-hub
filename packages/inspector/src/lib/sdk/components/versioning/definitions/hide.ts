import { Schemas } from '@dcl/ecs';
import { BaseComponentNames } from '../base-names';

const HIDE_BASE_NAME = BaseComponentNames.HIDE;

const HideV0 = {
  value: Schemas.Boolean,
};

export const HIDE_VERSIONS = [{ versionName: HIDE_BASE_NAME, component: HideV0 }];
