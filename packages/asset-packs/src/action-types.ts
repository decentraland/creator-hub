import type { IEngine, ISchema, JsonSchemaExtended } from '@dcl/ecs';
import { Schemas } from '@dcl/ecs';
import type { Action, ActionPayload, ActionType, ActionTypes } from './definitions';
import { ComponentName, getComponent } from './definitions';

export const EMPTY: JsonSchemaExtended = {
  type: 'object',
  properties: {},
  serializationType: 'map',
};

export function addActionType<T extends ISchema>(engine: IEngine, type: string, schema?: T) {
  const ActionTypes = getComponent<ActionTypes>(ComponentName.ACTION_TYPES, engine);
  const actionTypes = ActionTypes.getOrCreateMutable(engine.RootEntity);
  const actionType = {
    type,
    jsonSchema: JSON.stringify(schema?.jsonSchema || Schemas.Map({}).jsonSchema),
  };
  actionTypes.value = [
    ...actionTypes.value.filter(
      ($: { type: string; jsonSchema: string }) => $.type !== actionType.type,
    ),
    actionType,
  ];
}

export function getActionSchema<T = unknown>(engine: IEngine, type: string) {
  const ActionTypes = getComponent<ActionTypes>(ComponentName.ACTION_TYPES, engine);
  const actionTypes = ActionTypes.get(engine.RootEntity);
  const actionType = actionTypes.value.find(
    ($: { type: string; jsonSchema: string }) => $.type === type,
  );
  const jsonSchema: JsonSchemaExtended = actionType ? JSON.parse(actionType.jsonSchema) : EMPTY;
  return Schemas.fromJson(jsonSchema) as ISchema<T>;
}

export function getActionTypes(engine: IEngine) {
  const ActionTypes = getComponent<ActionTypes>(ComponentName.ACTION_TYPES, engine);
  const actionTypes = ActionTypes.get(engine.RootEntity);
  return actionTypes.value.map(($: { type: string; jsonSchema: string }) => $.type);
}

export function getPayload<T extends ActionType>(action: Action) {
  return JSON.parse(action.jsonPayload) as ActionPayload<T>;
}

export function getJson<T extends ActionType>(payload: ActionPayload<T>) {
  return JSON.stringify(payload);
}
