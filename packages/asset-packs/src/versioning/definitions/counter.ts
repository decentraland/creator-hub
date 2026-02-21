import { Schemas } from '@dcl/ecs';
import type { IEngine } from '@dcl/ecs';
import { BaseComponentNames } from '../../constants';

const COUNTER_BASE_NAME = BaseComponentNames.COUNTER;

const CounterV0 = {
  id: Schemas.Number,
  value: Schemas.Int,
};

export const COUNTER_VERSIONS = [CounterV0];

export function defineCounterComponent(engine: IEngine) {
  return engine.defineComponent(COUNTER_BASE_NAME, CounterV0);
}
