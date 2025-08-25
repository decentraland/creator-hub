import type { Entity } from '@dcl/ecs';

export interface Props {
  entity: Entity;
  initialOpen?: boolean;
}

export type AudioSourceInput = {
  audioClipUrl: string;
  playing?: boolean;
  loop?: boolean;
  volume?: string;
  global?: boolean;
};
