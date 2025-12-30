import type { ActionPayload, ActionType } from '@dcl/asset-packs';

export type Props = {
  value: Partial<ActionPayload<ActionType.SLIDE_TEXTURE>>;
  onUpdate: (value: ActionPayload<ActionType.SLIDE_TEXTURE>) => void;
};
