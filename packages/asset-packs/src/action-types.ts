import type { IEngine, ISchema, JsonSchemaExtended } from '@dcl/ecs';
import { Schemas } from '@dcl/ecs';
import type { Action, ActionPayload, ActionType } from './definitions';

export const EMPTY: JsonSchemaExtended = {
  type: 'object',
  properties: {},
  serializationType: 'map',
};

const actionTypesStore = new Map<string, string>();

export function addActionType<T extends ISchema>(_engine: IEngine, type: string, schema?: T) {
  const jsonSchema = JSON.stringify(schema?.jsonSchema || Schemas.Map({}).jsonSchema);
  actionTypesStore.set(type, jsonSchema);
}

export function getActionSchema<T = unknown>(_engine: IEngine, type: string) {
  const jsonSchema: JsonSchemaExtended = actionTypesStore.has(type)
    ? JSON.parse(actionTypesStore.get(type)!)
    : EMPTY;
  return Schemas.fromJson(jsonSchema) as ISchema<T>;
}

export function getActionTypes(_engine: IEngine) {
  return Array.from(actionTypesStore.keys());
}

export function getPayload<T extends ActionType>(action: Action) {
  return JSON.parse(action.jsonPayload) as ActionPayload<T>;
}

export function getJson<T extends ActionType>(payload: ActionPayload<T>) {
  return JSON.stringify(payload);
}
