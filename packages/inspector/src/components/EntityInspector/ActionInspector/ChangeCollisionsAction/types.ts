import type { ActionPayload, ActionType } from '@dcl/asset-packs';

export type Props = {
  value: Partial<ActionPayload<ActionType.CHANGE_COLLISIONS>>;
  onUpdate: (value: ActionPayload<ActionType.CHANGE_COLLISIONS>) => void;
};
