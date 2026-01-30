import { Schemas } from '@dcl/ecs';
import type { IEngine } from '@dcl/ecs';
import type { MapResult } from '@dcl/ecs/dist/schemas/Map';
import { BaseComponentNames } from '../base-names';

const INSPECTOR_UI_STATE_BASE_NAME = BaseComponentNames.INSPECTOR_UI_STATE;

const InspectorUIStateV0 = {
  sceneInfoPanelVisible: Schemas.Optional(Schemas.Boolean),
};

export const INSPECTOR_UI_STATE_VERSIONS = [
  { versionName: INSPECTOR_UI_STATE_BASE_NAME, component: InspectorUIStateV0 },
];

export function defineInspectorUIStateComponent(engine: IEngine) {
  return engine.defineComponent(INSPECTOR_UI_STATE_BASE_NAME, InspectorUIStateV0);
}

export type InspectorUIStateType = MapResult<typeof InspectorUIStateV0>;
