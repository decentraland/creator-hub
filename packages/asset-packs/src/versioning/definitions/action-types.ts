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

export const ACTION_TYPES_VERSIONS = [ActionTypesV0];

export function defineActionTypesComponent(engine: IEngine) {
  return engine.defineComponent(ACTION_TYPES_BASE_NAME, ActionTypesV0);
}
