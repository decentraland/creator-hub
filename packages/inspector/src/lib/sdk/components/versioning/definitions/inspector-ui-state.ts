import { Schemas } from '@dcl/ecs';

export const INSPECTOR_UI_STATE_VERSIONS = [
  { sceneInfoPanelVisible: Schemas.Optional(Schemas.Boolean) },
] as const;
