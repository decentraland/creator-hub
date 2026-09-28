import type { Entity } from '@dcl/ecs';
import type { TweenType } from '@dcl/asset-packs';

export interface Props {
  entity: Entity;
  initialOpen?: boolean;
}

export enum ContinuousTweenType {
  MOVE_CONTINUOUS = 'move_continuous',
  ROTATE_CONTINUOUS = 'rotate_continuous',
}

export const UNSUPPORTED_TWEEN_TYPE = 'unsupported';

export type TweenModeType = TweenType | ContinuousTweenType | typeof UNSUPPORTED_TWEEN_TYPE;

export type TweenInput = {
  type: TweenModeType;
  start: {
    x: string;
    y: string;
    z: string;
  };
  end: {
    x: string;
    y: string;
    z: string;
  };
  direction: {
    x: string;
    y: string;
    z: string;
  };
  speed: string;
  unsupportedMode: string;
  easingFunction: string;
  duration: string;
  playing?: boolean;
  relative?: boolean;
};

export type TweenSequenceInput = {
  loop?: boolean;
};
