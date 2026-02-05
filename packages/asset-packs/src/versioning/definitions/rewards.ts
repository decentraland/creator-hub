import { Schemas } from '@dcl/ecs';
import type { IEngine } from '@dcl/ecs';
import { BaseComponentNames } from '../../constants';

const REWARDS_BASE_NAME = BaseComponentNames.REWARDS;

const RewardsV0 = {
  campaignId: Schemas.String,
  dispenserKey: Schemas.String,
  testMode: Schemas.Boolean,
};

export const REWARDS_VERSIONS = [RewardsV0];

export function defineRewardsComponent(engine: IEngine) {
  return engine.defineComponent(REWARDS_BASE_NAME, RewardsV0);
}
