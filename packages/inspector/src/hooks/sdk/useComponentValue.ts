import { useEffect, useState } from 'react';
import type { DeepReadonly, Entity, LastWriteWinElementSetComponentDefinition } from '@dcl/ecs';
import { CrdtMessageType } from '@dcl/ecs';
import { recursiveCheck, deepEqualWithTolerance } from '../../lib/utils/deep-equal';

import type { Component } from '../../lib/sdk/components';
import { useChange } from './useChange';
import { useSdk } from './useSdk';

export function isLastWriteWinComponent<T = unknown>(
  component: Component,
): component is LastWriteWinElementSetComponentDefinition<T> {
  return !!(component as LastWriteWinElementSetComponentDefinition<unknown>).createOrReplace;
}

export const getComponentValue = <T>(entity: Entity, component: Component<T>): DeepReadonly<T> =>
  (isLastWriteWinComponent(component)
    ? component.getOrNull(entity) || component.schema.create()
    : component.get(entity)) as DeepReadonly<T>;

export const useComponentValue = <ComponentValueType>(
  entity: Entity,
  component: Component<ComponentValueType>,
  normalizeForComparison?: (value: ComponentValueType) => ComponentValueType,
  tolerance: number = 2, // floating-point tolerance for numeric comparisons (default: 2 decimal places)
) => {
  const componentValueType = getComponentValue(entity, component);
  const [value, setValue] = useState<ComponentValueType>(componentValueType as ComponentValueType);
  const sdk = useSdk();
  // sync entity changed
  useEffect(() => {
    setValue(getComponentValue(entity, component) as ComponentValueType);
  }, [entity]);

  // sync state -> engine
  useEffect(() => {
    if (value === null || isComponentEqual(value)) return;
    if (isLastWriteWinComponent(component) && sdk) {
      sdk.operations.updateValue(component, entity, value!);
      void sdk.operations.dispatch();
    } else {
      // TODO: handle update for GrowOnlyValueSetComponentDefinition
    }
  }, [value]);

  // sync engine -> state
  useChange(
    event => {
      if (
        entity === event.entity &&
        component.componentId === event.component?.componentId &&
        !!event.value
      ) {
        if (event.operation === CrdtMessageType.PUT_COMPONENT) {
          // TODO: This setValue is generating an isEqual comparission in previous effect.
          // Maybe we have to use two pure functions instead of an effect.
          // Same happens with the input & componentValue.
          setValue(event.value);
        } else {
          // TODO: handle update for GrowOnlyValueSetComponentDefinition
        }
      }
    },
    [entity, component],
  );

  function isComponentEqual(val: ComponentValueType) {
    const currentValue = getComponentValue(entity, component);

    if (normalizeForComparison) {
      const normalizedCurrent = normalizeForComparison(currentValue as ComponentValueType);
      const normalizedVal = normalizeForComparison(val);
      return deepEqualWithTolerance(normalizedCurrent, normalizedVal, tolerance);
    }

    // fallback to original comparison
    return !recursiveCheck(currentValue, val, tolerance);
  }

  return [value, setValue, isComponentEqual] as const;
};
