import { Schemas } from '@dcl/ecs';
import type { IEngine } from '@dcl/ecs';
import { BaseComponentNames } from '../../enums';

const COUNTER_BASE_NAME = BaseComponentNames.COUNTER;

const CounterV0 = {
  id: Schemas.Number,
  value: Schemas.Int,
};

const CounterV1 = {
  ...CounterV0,
  random: Schemas.Optional(Schemas.Boolean),
};

export const COUNTER_VERSIONS = [
  { versionName: COUNTER_BASE_NAME, component: CounterV0 },
  { versionName: `${COUNTER_BASE_NAME}-v1`, component: CounterV1 },
];

export function defineCounterComponent(engine: IEngine) {
  engine.defineComponent(COUNTER_BASE_NAME, CounterV0);
  return engine.defineComponent(`${COUNTER_BASE_NAME}-v1`, CounterV1);
}
