import { Schemas } from '@dcl/ecs';
import type { MapResult } from '@dcl/ecs/dist/schemas/Map';

// Type-only mirror of the LATEST `inspector::UIState` version — every version diff
// in versioning/registry.ts merged, which is what `defineAllComponents` hands
// consumers. The registry is the runtime definition; editing one without the other
// silently no-ops.
export const InspectorUIStateSchema = {
  sceneInfoPanelVisible: Schemas.Optional(Schemas.Boolean),
  uiDesignerOpen: Schemas.Optional(Schemas.Boolean),
};

export type InspectorUIStateType = MapResult<typeof InspectorUIStateSchema>;
