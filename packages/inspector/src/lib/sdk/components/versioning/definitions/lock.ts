import { Schemas } from '@dcl/ecs';
import type { IEngine } from '@dcl/ecs';
import { BaseComponentNames } from '../base-names';

const LOCK_BASE_NAME = BaseComponentNames.LOCK;

const LockV0 = {
  value: Schemas.Boolean,
};

export const LOCK_VERSIONS = [{ versionName: LOCK_BASE_NAME, component: LockV0 }];

export function defineLockComponent(engine: IEngine) {
  return engine.defineComponent(LOCK_BASE_NAME, LockV0);
}
