import type { Entity } from '@dcl/ecs';

export interface Props {
  entity: Entity;
  initialOpen?: boolean;
}
export type SpawnPointInput = {
  name: string;
  default: boolean;
  position: {
    x: number;
    y: number;
    z: number;
  };
  randomOffset: boolean;
  maxOffset: number;
  cameraTarget: {
    x: number;
    y: number;
    z: number;
  };
};
