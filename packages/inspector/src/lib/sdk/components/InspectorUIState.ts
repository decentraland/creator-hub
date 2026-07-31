import { Schemas } from '@dcl/ecs';
import type { MapResult } from '@dcl/ecs/dist/schemas/Map';

// Type-only mirror of the `inspector::UIState` entry in versioning/registry.ts,
// which is the runtime definition. Editing one without the other silently no-ops.
export const InspectorUIStateSchema = {
  sceneInfoPanelVisible: Schemas.Optional(Schemas.Boolean),
  uiDesignerOpen: Schemas.Optional(Schemas.Boolean),
};

export type InspectorUIStateType = MapResult<typeof InspectorUIStateSchema>;
