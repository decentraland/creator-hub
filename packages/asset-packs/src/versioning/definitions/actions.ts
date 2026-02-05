import { Schemas } from '@dcl/ecs';
import type { IEngine } from '@dcl/ecs';
import { BaseComponentNames } from '../../constants';

const ACTIONS_BASE_NAME = BaseComponentNames.ACTIONS;

const ActionsV0 = {
  id: Schemas.Int,
  value: Schemas.Array(
    Schemas.Map({
      name: Schemas.String,
      type: Schemas.String,
      jsonPayload: Schemas.String,
      allowedInBasicView: Schemas.Optional(Schemas.Boolean),
      basicViewId: Schemas.Optional(Schemas.String),
      default: Schemas.Optional(Schemas.Boolean),
    }),
  ),
};

export const ACTIONS_VERSIONS = [ActionsV0];

export function defineActionsComponent(engine: IEngine) {
  return engine.defineComponent(ACTIONS_BASE_NAME, ActionsV0);
}
