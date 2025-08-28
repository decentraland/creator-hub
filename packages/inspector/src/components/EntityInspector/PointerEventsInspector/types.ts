import type { Entity, PBPointerEvents_Entry } from '@dcl/ecs';

export interface Props {
  entity: Entity;
  initialOpen?: boolean;
}

export type AnimatorInput = {
  pointerEvents: PBPointerEvents_Entry[];
};
