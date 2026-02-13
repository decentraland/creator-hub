import { Schemas } from '@dcl/ecs';
import type { IEngine } from '@dcl/ecs';
import { BaseComponentNames } from '../../constants';

const COUNTER_BAR_BASE_NAME = BaseComponentNames.COUNTER_BAR;

const CounterBarV0 = {
  primaryColor: Schemas.Optional(Schemas.String),
  secondaryColor: Schemas.Optional(Schemas.String),
  maxValue: Schemas.Optional(Schemas.Float),
};

export const COUNTER_BAR_VERSIONS = [CounterBarV0];

export function defineCounterBarComponent(engine: IEngine) {
  return engine.defineComponent(COUNTER_BAR_BASE_NAME, CounterBarV0);
}
