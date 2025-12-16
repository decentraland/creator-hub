import type { Entity } from '@dcl/ecs';

export interface Props {
  entities: Entity[];
  initialOpen?: boolean;
}

export type StatesInput = {
  value: string[];
  defaultValue?: string;
};
