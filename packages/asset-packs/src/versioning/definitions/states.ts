import { Schemas } from '@dcl/ecs';
import type { IEngine } from '@dcl/ecs';
import { BaseComponentNames } from '../../constants';

const STATES_BASE_NAME = BaseComponentNames.STATES;

const StatesV0 = {
  id: Schemas.Number,
  value: Schemas.Array(Schemas.String),
  defaultValue: Schemas.Optional(Schemas.String),
  currentValue: Schemas.Optional(Schemas.String),
  previousValue: Schemas.Optional(Schemas.String),
};

const StatesV1 = {
  ...StatesV0,
  newTestProp: Schemas.Optional(Schemas.Boolean),
};

export const STATES_VERSIONS = [
  { versionName: STATES_BASE_NAME, component: StatesV0 },
  { versionName: `${STATES_BASE_NAME}-v1`, component: StatesV1 },
];

export function defineStatesComponent(engine: IEngine) {
  engine.defineComponent(STATES_BASE_NAME, StatesV0);
  return engine.defineComponent(`${STATES_BASE_NAME}-v1`, StatesV1);
}
