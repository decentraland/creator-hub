import type { ActionPayload, ActionType } from '@dcl/asset-packs';

export type Props = {
  value: ActionPayload<ActionType.LIGHTS_MODIFY>;
  onUpdate: (value: ActionPayload<ActionType.LIGHTS_MODIFY>) => void;
};
