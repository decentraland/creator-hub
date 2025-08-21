import type { ComponentDefinition } from '@dcl/ecs';
import type { EcsEntity } from './EcsEntity';

export type ComponentOperation = <T>(
  ecsEntity: EcsEntity,
  component: ComponentDefinition<T>,
) => void;
