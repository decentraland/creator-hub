import type { AnimationGroup } from '@babylonjs/core';
import type { ActionPayload, ActionType } from '@dcl/asset-packs';

export interface Props {
  value: Partial<ActionPayload<ActionType.PLAY_ANIMATION>>;
  animations: AnimationGroup[];
  onUpdate: (value: ActionPayload<ActionType.PLAY_ANIMATION>) => void;
}
