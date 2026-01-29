import { Schemas } from '@dcl/ecs';
import type { IEngine } from '@dcl/ecs';
import { BaseComponentNames } from '../../constants';

const REWARDS_BASE_NAME = BaseComponentNames.REWARDS;

const RewardsV0 = {
  campaignId: Schemas.String,
  dispenserKey: Schemas.String,
  testMode: Schemas.Boolean,
};

const RewardsV1 = {
  ...RewardsV0,
  newTestProp: Schemas.Optional(Schemas.Boolean),
};

export const REWARDS_VERSIONS = [
  { versionName: REWARDS_BASE_NAME, component: RewardsV0 },
  { versionName: `${REWARDS_BASE_NAME}-v1`, component: RewardsV1 },
];

export function defineRewardsComponent(engine: IEngine) {
  engine.defineComponent(REWARDS_BASE_NAME, RewardsV0);
  return engine.defineComponent(`${REWARDS_BASE_NAME}-v1`, RewardsV1);
}
