import type { ActionPayload, ActionType } from '@dcl/asset-packs';

export type Props = {
  value: ActionPayload<ActionType.CHANGE_CAMERA>;
  onUpdate: (value: ActionPayload<ActionType.CHANGE_CAMERA>) => void;
};
