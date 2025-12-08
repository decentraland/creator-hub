import type { Emitter } from 'mitt';
import mitt from 'mitt';
import type { Entity } from '@dcl/ecs';
import type { ActionPayload, ActionType, TriggerType } from './definitions';

const triggers = new Map<Entity, Emitter<Record<TriggerType, void>>>();

const actions = new Map<Entity, Emitter<Record<string, ActionPayload<ActionType>>>>();

export function getTriggerEvents(entity: Entity) {
  if (!triggers.has(entity)) {
    triggers.set(entity, mitt());
  }
  return triggers.get(entity)!;
}

export function getActionEvents(entity: Entity) {
  if (!actions.has(entity)) {
    actions.set(entity, mitt());
  }
  return actions.get(entity)!;
}
