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

export const SCRIPT_VERSIONS = [ScriptV0];

export function defineScriptComponent(engine: IEngine) {
  return engine.defineComponent(SCRIPT_BASE_NAME, ScriptV0);
}
