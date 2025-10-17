import type { Entity } from '@dcl/ecs';
import type { MaterialInput } from '../MaterialInspector/types';

export type Props = { entity: Entity; initialOpen?: boolean };

export type SwapInput = {
  path?: string;
  castShadows?: boolean;
  material: MaterialInput;
};

export type Input = {
  swaps: SwapInput[];
};
