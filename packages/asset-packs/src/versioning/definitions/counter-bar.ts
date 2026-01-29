import { Schemas } from '@dcl/ecs';
import type { IEngine } from '@dcl/ecs';
import { BaseComponentNames } from '../../constants';

const COUNTER_BAR_BASE_NAME = BaseComponentNames.COUNTER_BAR;

const CounterBarV0 = {
  primaryColor: Schemas.Optional(Schemas.String),
  secondaryColor: Schemas.Optional(Schemas.String),
  maxValue: Schemas.Optional(Schemas.Float),
};

const CounterBarV1 = {
  ...CounterBarV0,
  newTestProp: Schemas.Optional(Schemas.Boolean),
};

export const COUNTER_BAR_VERSIONS = [
  { versionName: COUNTER_BAR_BASE_NAME, component: CounterBarV0 },
  { versionName: `${COUNTER_BAR_BASE_NAME}-v1`, component: CounterBarV1 },
];

export function defineCounterBarComponent(engine: IEngine) {
  engine.defineComponent(COUNTER_BAR_BASE_NAME, CounterBarV0);
  return engine.defineComponent(`${COUNTER_BAR_BASE_NAME}-v1`, CounterBarV1);
}
