import { Schemas } from '@dcl/ecs';
import type { IEngine } from '@dcl/ecs';
import { BaseComponentNames } from '../../constants';

const ACTION_TYPES_BASE_NAME = BaseComponentNames.ACTION_TYPES;

const ActionTypesV0 = {
  value: Schemas.Array(
    Schemas.Map({
      type: Schemas.String,
      jsonSchema: Schemas.String,
    }),
  ),
};

const ActionTypesV1 = {
  ...ActionTypesV0,
  newTestProp: Schemas.Optional(Schemas.Boolean),
};

export const ACTION_TYPES_VERSIONS = [
  { versionName: ACTION_TYPES_BASE_NAME, component: ActionTypesV0 },
  { versionName: `${ACTION_TYPES_BASE_NAME}-v1`, component: ActionTypesV1 },
];

export function defineActionTypesComponent(engine: IEngine) {
  engine.defineComponent(ACTION_TYPES_BASE_NAME, ActionTypesV0);
  return engine.defineComponent(`${ACTION_TYPES_BASE_NAME}-v1`, ActionTypesV1);
}
