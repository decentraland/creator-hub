import type { Entity } from '@dcl/ecs';

export interface Props {
  entity: Entity;
  initialOpen?: boolean;
}

export type VideoPlayerInput = {
  src: string;
  playing?: boolean;
  loop?: boolean;
  volume?: string;
  position?: string;
  playbackRate?: string;
  spatial?: boolean;
  spatialMinDistance?: string;
  spatialMaxDistance?: string;
};
