import { Schemas } from '@dcl/ecs';
import type { MapResult } from '@dcl/ecs/dist/schemas/Map';

export const InspectorUIStateSchema = {
  sceneInfoPanelVisible: Schemas.Optional(Schemas.Boolean),
};

export type InspectorUIStateType = MapResult<typeof InspectorUIStateSchema>;
