import type { Action } from '@dcl/asset-packs';
import type { Entity } from '@dcl/ecs';

export interface Props {
  entities: Entity[];
  initialOpen?: boolean;
}

// Type for action items in the list (used for multi-entity editing)
export interface ActionItem {
  action: Action;
  isPartial: boolean;
  hasTypeMismatch: boolean;
  mergedPayload: Record<string, unknown>;
}
