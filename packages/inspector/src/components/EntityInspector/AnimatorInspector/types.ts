import type { Entity, PBAnimationState } from '@dcl/ecs';

export interface Props {
  entity: Entity;
  initialOpen?: boolean;
}

export type AnimatorInput = {
  states: PBAnimationState[];
};
