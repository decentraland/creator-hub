import { Schemas } from '@dcl/ecs';
import type { IEngine } from '@dcl/ecs';
import { BaseComponentNames } from '../../constants';

const SCRIPT_BASE_NAME = BaseComponentNames.SCRIPT;

const ScriptV0 = {
  value: Schemas.Array(
    Schemas.Map({
      path: Schemas.String,
      priority: Schemas.Number,
      layout: Schemas.Optional(Schemas.String),
    }),
  ),
};

const ScriptV1 = {
  ...ScriptV0,
  newTestProp: Schemas.Optional(Schemas.Boolean),
};

export const SCRIPT_VERSIONS = [
  { versionName: SCRIPT_BASE_NAME, component: ScriptV0 },
  { versionName: `${SCRIPT_BASE_NAME}-v1`, component: ScriptV1 },
];

export function defineScriptComponent(engine: IEngine) {
  engine.defineComponent(SCRIPT_BASE_NAME, ScriptV0);
  return engine.defineComponent(`${SCRIPT_BASE_NAME}-v1`, ScriptV1);
}
