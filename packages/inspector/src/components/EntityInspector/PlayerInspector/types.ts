import type { Entity } from '@dcl/ecs';
import type { Vector3 } from '@dcl/sdk/math';

export interface Props {
  entity: Entity;
  initialOpen?: boolean;
}
export type SpawnPointInput = {
  name: string;
  default: boolean;
  position: Vector3;
  randomOffset: boolean;
  maxOffset: number;
  cameraTarget: Vector3;
};
