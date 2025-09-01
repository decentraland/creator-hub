import type { Entity } from '@dcl/ecs';

export interface Props {
  entity: Entity;
  initialOpen?: boolean;
}

export type AudioStreamInput = {
  url: string;
  playing?: boolean;
  volume?: string;
};
