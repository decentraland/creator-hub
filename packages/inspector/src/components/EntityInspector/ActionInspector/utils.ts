import type { Action, ActionPayload } from '@dcl/asset-packs';
import {
  ActionType,
  InterpolationType,
  TweenType,
  getJson,
  getPayload,
  Font,
  AlignMode,
} from '@dcl/asset-packs';
import type { Entity } from '@dcl/ecs';
import { allEqual } from '../../../lib/utils/array';
import type { EditorComponentsTypes } from '../../../lib/sdk/components';
import { MIXED_VALUE } from '../../ui/utils';
import type { ActionItem } from './types';

export function isStates(maybeStates: any): maybeStates is EditorComponentsTypes['States'] {
  return !!maybeStates && 'value' in maybeStates && Array.isArray(maybeStates.value);
}

export function getPartialPayload<T extends ActionType>(action: Action) {
  return getPayload<T>(action) as Partial<ActionPayload<T>>;
}

export function getDefaultPayload(type: string) {
  switch (type) {
    case ActionType.SET_VISIBILITY: {
      return getJson<ActionType.SET_VISIBILITY>({
        visible: true,
      });
    }
    case ActionType.START_TWEEN: {
      return getJson<ActionType.START_TWEEN>({
        type: TweenType.MOVE_ITEM,
        end: {
          x: 0,
          y: 0,
          z: 0,
        },
        relative: true,
        interpolationType: InterpolationType.LINEAR,
        duration: 1,
      });
    }
    case ActionType.TELEPORT_PLAYER: {
      return getJson<ActionType.TELEPORT_PLAYER>({
        x: 0,
        y: 0,
      });
    }
    case ActionType.MOVE_PLAYER: {
      return getJson<ActionType.MOVE_PLAYER>({
        position: {
          x: 0,
          y: 0,
          z: 0,
        },
      });
    }
    case ActionType.SHOW_TEXT: {
      return getJson<ActionType.SHOW_TEXT>({
        text: '',
        hideAfterSeconds: 5,
        font: Font.F_SANS_SERIF,
        fontSize: 10,
        textAlign: AlignMode.TAM_MIDDLE_CENTER,
      });
    }
    case ActionType.START_DELAY: {
      return getJson<ActionType.START_DELAY>({
        actions: [],
        timeout: 5,
      });
    }
    case ActionType.START_LOOP: {
      return getJson<ActionType.START_LOOP>({
        actions: [],
        interval: 5,
      });
    }
    case ActionType.STOP_DELAY:
    case ActionType.STOP_LOOP: {
      return getJson<typeof type>({
        action: '',
      });
    }
    case ActionType.FOLLOW_PLAYER: {
      return getJson<ActionType.FOLLOW_PLAYER>({
        speed: 1,
        x: true,
        y: true,
        z: true,
        minDistance: 0.5,
      });
    }
    case ActionType.INCREMENT_COUNTER: {
      return getJson<ActionType.INCREMENT_COUNTER>({
        amount: 1,
      });
    }
    case ActionType.DECREASE_COUNTER: {
      return getJson<ActionType.DECREASE_COUNTER>({
        amount: 1,
      });
    }
    default: {
      return '{}';
    }
  }
}

// Transform functions for useComponentListInput
export function getActionsItems(componentValue: EditorComponentsTypes['Actions']): Action[] {
  return componentValue.value;
}

export function setActionsItems(
  items: Action[],
  currentValue: EditorComponentsTypes['Actions'],
): EditorComponentsTypes['Actions'] {
  return { ...currentValue, value: items };
}

// Key extractor for Actions (used by hook for partitioning by name)
export function getActionKey(action: Action): string {
  return action.name;
}

// Get action type across entities (returns MIXED_VALUE if different)
export function getActionTypeAcrossEntities(
  entityValuesMap: Map<Entity, EditorComponentsTypes['Actions']>,
  actionName: string,
): string {
  const types = Array.from(entityValuesMap.values()).map(component => {
    const action = component.value.find(a => a.name === actionName);
    return action?.type;
  });

  if (allEqual(types, t => t)) {
    return types[0] ?? '';
  }
  return MIXED_VALUE;
}

// Check if action types are the same across all entities
export function areActionTypesEqual(
  entityValuesMap: Map<Entity, EditorComponentsTypes['Actions']>,
  actionName: string,
): boolean {
  const types = Array.from(entityValuesMap.values()).map(component => {
    const action = component.value.find(a => a.name === actionName);
    return action?.type;
  });
  return allEqual(types, t => t);
}

// Validate actions (for useComponentListInput)
export function validateActions(actions: Action[]): boolean {
  // Actions are valid if all have a name (basic validation)
  return actions.every(action => action.name && action.name.trim().length > 0);
}

// Helper function to recursively merge values (same as useComponentInput)
export const mergeValues = (values: unknown[]): unknown => {
  // Base case - if any value is not an object, compare directly
  if (!values.every(val => val && typeof val === 'object' && !Array.isArray(val))) {
    return values.every(val => val === values[0]) ? values[0] : MIXED_VALUE;
  }

  // Get all keys from all objects
  const allKeys = [...new Set(values.flatMap(obj => Object.keys(obj as object)))];

  // Create result object
  const result: Record<string, unknown> = {};

  // For each key, recursively merge values
  for (const key of allKeys) {
    const valuesForKey = values.map(obj => (obj as Record<string, unknown>)[key]);
    result[key] = mergeValues(valuesForKey);
  }

  return result;
};

// Merge JSON payloads from multiple actions
export const mergeActionPayloads = (actions: Action[]): Record<string, unknown> => {
  const payloads = actions.map(a => {
    try {
      return JSON.parse(a.jsonPayload || '{}');
    } catch {
      return {};
    }
  });
  return mergeValues(payloads) as Record<string, unknown>;
};

// Get entity values map for all entities
export function getEntityValuesMap(
  entities: Entity[],
  Actions: { getOrNull: (entity: Entity) => unknown },
): Map<Entity, EditorComponentsTypes['Actions']> {
  const map = new Map<Entity, EditorComponentsTypes['Actions']>();
  for (const entity of entities) {
    const value = Actions.getOrNull(entity) as EditorComponentsTypes['Actions'] | null;
    if (value) {
      map.set(entity, { ...value, value: [...value.value] });
    }
  }
  return map;
}

// Compute common and partial actions from all entities
export function computeActionItems(
  entityValuesMap: Map<Entity, EditorComponentsTypes['Actions']>,
  entityCount: number,
): ActionItem[] {
  // Count occurrences of each action name
  const actionNameCounts = new Map<string, number>();
  const actionsByName = new Map<string, Action[]>();

  for (const component of entityValuesMap.values()) {
    for (const action of component.value) {
      const count = actionNameCounts.get(action.name) || 0;
      actionNameCounts.set(action.name, count + 1);

      const actions = actionsByName.get(action.name) || [];
      actions.push(action);
      actionsByName.set(action.name, actions);
    }
  }

  const items: ActionItem[] = [];
  const processedNames = new Set<string>();

  // Process actions in order (from first entity)
  const firstEntityComponent = Array.from(entityValuesMap.values())[0];
  if (firstEntityComponent) {
    for (const action of firstEntityComponent.value) {
      if (processedNames.has(action.name)) continue;
      processedNames.add(action.name);

      const count = actionNameCounts.get(action.name) || 0;
      const isPartial = count < entityCount;
      const actionsWithName = actionsByName.get(action.name) || [];

      // Check if types match across all entities
      const types = actionsWithName.map(a => a.type);
      const hasTypeMismatch = !types.every(t => t === types[0]);

      // Compute merged payload (handles MIXED_VALUE for differing fields)
      const mergedPayload = hasTypeMismatch ? {} : mergeActionPayloads(actionsWithName);

      items.push({
        action,
        isPartial,
        hasTypeMismatch,
        mergedPayload,
      });
    }
  }

  // Add partial actions from other entities
  for (const component of entityValuesMap.values()) {
    for (const action of component.value) {
      if (processedNames.has(action.name)) continue;
      processedNames.add(action.name);

      const count = actionNameCounts.get(action.name) || 0;
      const isPartial = count < entityCount;

      // For partial actions, use the action's own payload
      const payload = (() => {
        try {
          return JSON.parse(action.jsonPayload || '{}');
        } catch {
          return {};
        }
      })();

      items.push({
        action,
        isPartial,
        hasTypeMismatch: false,
        mergedPayload: payload,
      });
    }
  }

  return items;
}
