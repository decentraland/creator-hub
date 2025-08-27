import { useMemo } from 'react';
import { type Entity } from '@dcl/ecs';
import { AllComponents } from '../../../lib/sdk/components/types';
import type { SdkContextValue, SdkContextComponents } from '../../../lib/sdk/context';
import { useTree } from '../../../hooks/sdk/useTree';

export function getEnumKeyByValue(value: string): keyof typeof AllComponents | undefined {
  return Object.entries(AllComponents).find(([_, v]) => v === value)?.[0] as
    | keyof typeof AllComponents
    | undefined;
}

export function isBooleanValue(value: unknown): boolean {
  return value === 'true' || value === true || value === false || value === 'false';
}

export function isTrueValue(value: unknown): boolean {
  return value === 'true' || value === true || value === 1 || value === '1';
}

// TODO: This is a temporary solution to get the component by type. We need to find a better way to do this.
export function getComponentByType(sdk: SdkContextValue, type: string): any {
  if (!type || !sdk) return null;

  try {
    const parts = type.split('::');
    if (parts.length !== 2) {
      return null;
    }

    const [_, componentName] = parts;

    const component = getEnumKeyByValue(type);
    if (!component) return null;

    return sdk.components[componentName as keyof SdkContextComponents] || null;
  } catch (error) {
    return null;
  }
}

// Utility function to check if an entity or any of its children have actions or triggers
export const useEntityOrChildrenHasComponents = (entity: Entity, sdk: SdkContextValue) => {
  const { Actions, Triggers } = sdk.components;
  const { getChildren } = useTree();

  return useMemo(() => {
    const hasActions = Actions.has(entity);
    const hasTriggers = Triggers.has(entity);

    // If the entity itself has the components, return early
    if (hasActions || hasTriggers) {
      return { hasActions, hasTriggers };
    }

    // Check children recursively
    const checkChildren = (parentEntity: Entity): { hasActions: boolean; hasTriggers: boolean } => {
      const children = getChildren(parentEntity);

      if (children.length === 0) {
        return { hasActions: false, hasTriggers: false };
      }

      let childrenHasActions = false;
      let childrenHasTriggers = false;

      for (const childEntity of children) {
        const childHasActions = Actions.has(childEntity);
        const childHasTriggers = Triggers.has(childEntity);

        if (childHasActions || childHasTriggers) {
          childrenHasActions = childrenHasActions || childHasActions;
          childrenHasTriggers = childrenHasTriggers || childHasTriggers;

          // Early return if we found both
          if (childrenHasActions && childrenHasTriggers) {
            break;
          }
        }

        // Recursively check grandchildren if we haven't found both yet
        if (!childrenHasActions || !childrenHasTriggers) {
          const grandChildrenResult = checkChildren(childEntity);
          childrenHasActions = childrenHasActions || grandChildrenResult.hasActions;
          childrenHasTriggers = childrenHasTriggers || grandChildrenResult.hasTriggers;
        }
      }

      return { hasActions: childrenHasActions, hasTriggers: childrenHasTriggers };
    };

    return checkChildren(entity);
  }, [entity, Actions, Triggers, getChildren]);
};
