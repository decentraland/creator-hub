import { Schemas } from '@dcl/ecs';
import type { IEngine } from '@dcl/ecs';
import { TriggerType, TriggerConditionType, TriggerConditionOperation } from './trigger-enums';

const TRIGGERS_BASE_NAME = 'asset-packs::Triggers';

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

const TriggersV1 = {
  ...TriggersV0,
  newTestProp: Schemas.Optional(Schemas.Boolean),
};

export const TRIGGERS_VERSIONS = [
  { versionName: TRIGGERS_BASE_NAME, component: TriggersV0 },
  { versionName: `${TRIGGERS_BASE_NAME}-v1`, component: TriggersV1 },
];

export function defineTriggersComponent(engine: IEngine) {
  engine.defineComponent(TRIGGERS_BASE_NAME, TriggersV0);
  return engine.defineComponent(`${TRIGGERS_BASE_NAME}-v1`, TriggersV1);
}
