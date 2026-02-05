import { Schemas } from '@dcl/ecs';
import type { IEngine } from '@dcl/ecs';
import { BaseComponentNames } from '../../constants';
import { TriggerType, TriggerConditionType, TriggerConditionOperation } from '../../trigger-enums';

const TRIGGERS_BASE_NAME = BaseComponentNames.TRIGGERS;

const TriggersV0 = {
  value: Schemas.Array(
    Schemas.Map({
      type: Schemas.EnumString<TriggerType>(TriggerType, TriggerType.ON_INPUT_ACTION),
      conditions: Schemas.Optional(
        Schemas.Array(
          Schemas.Map({
            id: Schemas.Optional(Schemas.Int),
            type: Schemas.EnumString<TriggerConditionType>(
              TriggerConditionType,
              TriggerConditionType.WHEN_STATE_IS,
            ),
            value: Schemas.String,
          }),
        ),
      ),
      operation: Schemas.Optional(
        Schemas.EnumString<TriggerConditionOperation>(
          TriggerConditionOperation,
          TriggerConditionOperation.AND,
        ),
      ),
      actions: Schemas.Array(
        Schemas.Map({
          id: Schemas.Optional(Schemas.Int),
          name: Schemas.Optional(Schemas.String),
        }),
      ),
      basicViewId: Schemas.Optional(Schemas.String),
    }),
  ),
};

export const TRIGGERS_VERSIONS = [TriggersV0];

export function defineTriggersComponent(engine: IEngine) {
  return engine.defineComponent(TRIGGERS_BASE_NAME, TriggersV0);
}
