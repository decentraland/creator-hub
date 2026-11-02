import { Schemas } from '@dcl/ecs';
import type { MapResult } from '@dcl/ecs/dist/schemas/Map';

/** Type-only mirror of the latest `inspector::UIState` version; the runtime definition lives in versioning/registry.ts. */
export const InspectorUIStateSchema = {
  sceneInfoPanelVisible: Schemas.Optional(Schemas.Boolean),
};

export type InspectorUIStateType = MapResult<typeof InspectorUIStateSchema>;
