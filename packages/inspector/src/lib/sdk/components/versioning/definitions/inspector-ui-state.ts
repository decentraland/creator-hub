import { Schemas } from '@dcl/ecs';

const InspectorUIStateV0 = { sceneInfoPanelVisible: Schemas.Optional(Schemas.Boolean) };

export const INSPECTOR_UI_STATE_VERSIONS = [InspectorUIStateV0] as const;
