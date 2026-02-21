import type { Entity } from '@dcl/ecs';

export interface Props {
  entity: Entity;
  initialOpen?: boolean;
}

export type PlaceholderInput = {
  src: string;
};
