import { Schemas } from '@dcl/ecs';

const COUNTER_BASE_NAME = 'asset-packs::Counter';

const CounterV0 = {
  id: Schemas.Number,
  value: Schemas.Int,
};

const CounterV1 = {
  id: Schemas.Number,
  value: Schemas.Int,
  random: Schemas.Boolean,
};

export const COUNTER_VERSIONS = [
  { versionName: COUNTER_BASE_NAME, component: CounterV0 },
  { versionName: `${COUNTER_BASE_NAME}-v1`, component: CounterV1 },
];
