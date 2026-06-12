import type { ActionPayload, ActionType } from '@dcl/asset-packs';

export interface Props {
  value: Partial<ActionPayload<ActionType.PLAY_ANIMATION>>;
  /** Animation clip names available on the entity's GLTF. */
  animations: string[];
  onUpdate: (value: ActionPayload<ActionType.PLAY_ANIMATION>) => void;
}

export enum PLAY_MODE {
  PLAY_ONCE = 'play-once',
  LOOP = 'loop',
}

export const PLAY_MODE_OPTIONS = [
  {
    label: 'Play Once',
    value: PLAY_MODE.PLAY_ONCE,
  },
  {
    label: 'Loop',
    value: PLAY_MODE.LOOP,
  },
];
