import type { ActionPayload, ActionType } from '@dcl/asset-packs';

export interface Props {
  value: Partial<ActionPayload<ActionType.SPAWN_ITEM>>;
  onUpdate: (value: ActionPayload<ActionType.SPAWN_ITEM>) => void;
}
