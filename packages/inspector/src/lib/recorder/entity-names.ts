import type { Entity, IEngine } from '@dcl/ecs';
import { Name as NameEngine } from '@dcl/ecs';

import { entityLabel } from './text';
import type { EntityRef } from './types';

// The reserved entities carry no Name; label them the way the entity tree does
// (and `get_selection` in the scene RPC server).
export function nameOf(engine: IEngine, entity: Entity): string | undefined {
  if (entity === engine.RootEntity) return 'Scene';
  if (entity === engine.PlayerEntity) return 'Player';
  if (entity === engine.CameraEntity) return 'Camera';
  const Name = engine.getComponentOrNull(NameEngine.componentName) as typeof NameEngine | null;
  return Name?.getOrNull(entity)?.value || undefined;
}

export function entityRef(engine: IEngine, entity: Entity, knownName?: string): EntityRef {
  const name = knownName ?? nameOf(engine, entity);
  return name ? { id: entity as number, name } : { id: entity as number };
}

export function describeEntity(engine: IEngine, entity: Entity, knownName?: string): string {
  return entityLabel(knownName ?? nameOf(engine, entity) ?? 'Unnamed entity', entity as number);
}
