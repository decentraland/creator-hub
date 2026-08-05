import { Schemas } from '@dcl/ecs';
import type { MapResult } from '@dcl/ecs/dist/schemas/Map';

// Type-only mirror of the LATEST `inspector::UIState` version — i.e. every
// version diff in versioning/registry.ts merged, which is what
// `defineAllComponents` hands consumers. The registry is the runtime definition;
// editing one without the other silently no-ops.
//
// Adding a field here means adding a NEW version diff in the registry, never
// editing a shipped one: an object schema is a positional `Schemas.Map`, so a
// member added to a released version breaks the wire both ways.
export const InspectorUIStateSchema = {
  sceneInfoPanelVisible: Schemas.Optional(Schemas.Boolean),
  uiDesignerOpen: Schemas.Optional(Schemas.Boolean),
};

export type InspectorUIStateType = MapResult<typeof InspectorUIStateSchema>;
