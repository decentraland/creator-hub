import type { Entity } from '@dcl/ecs';

export interface Props {
  entities: Entity[];
}

export type TagsInput = {
  tags: string[];
};
