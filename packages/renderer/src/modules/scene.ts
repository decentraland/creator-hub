import type { CompositeDefinition } from '@dcl/ecs';
import type { Scene as SceneMetadata } from '@dcl/schemas';

export type Scene = {
  id: string;
  composite: CompositeDefinition;
  mappings: Record<string, string>;
  metadata?: Omit<SceneMetadata, 'main'> & { rating?: 'T' | 'A' };
};
