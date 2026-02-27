import type { InputHTMLAttributes } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Entity } from '@dcl/ecs';
import { CrdtMessageType } from '@dcl/ecs';
import { intersection, partitionByFrequency } from '../../lib/utils/array';
import { recursiveCheck as hasDiff } from '../../lib/utils/deep-equal';
import type { NestedKey } from '../../lib/logic/get-set-value';
import { getValue, setValue } from '../../lib/logic/get-set-value';
import type { Component } from '../../lib/sdk/components';
import { MIXED_VALUE } from '../../components/ui/utils';
import { getComponentValue, isLastWriteWinComponent, useComponentValue } from './useComponentValue';
import { useSdk } from './useSdk';
import { useChange } from './useChange';

type Input = {
  [key: string]:
    | boolean
    | string
    | string[]
    | any[]
    | Record<string, boolean | string | string[] | any[] | Input>;
};

export function isValidNumericInput(input: Input[keyof Input]): boolean {
  if (typeof input === 'object') {
    return Object.values(input).every(value => isValidNumericInput(value));
  }
  if (typeof input === 'boolean') {
    return !!input;
  }
  if (typeof input === 'number') {
    return !isNaN(input);
  }
  return input.length > 0 && !isNaN(Number(input));
}

export type UseComponentInputOptions<InputType extends Input> = {
  validateInput?: (input: InputType) => boolean;
  deps?: unknown[];
  tolerance?: number;
};

export const useComponentInput = <ComponentValueType extends object, InputType extends Input>(
  entity: Entity,
  component: Component<ComponentValueType>,
  fromComponentValueToInput: (componentValue: ComponentValueType) => InputType,
  fromInputToComponentValue: (input: InputType) => ComponentValueType,
  {
    validateInput = () => true,
    deps = [],
    tolerance = 2,
  }: UseComponentInputOptions<InputType> = {},
) => {
  // Create a normalization function that handles the round-trip transformation
  const normalizeForComparison = useCallback(
    (value: ComponentValueType): ComponentValueType => {
      try {
        const inputForm = fromComponentValueToInput(value);
        return fromInputToComponentValue(inputForm);
      } catch (error) {
        console.warn('Failed to normalize component value for comparison:', error);
        return value; // if transformation fails, return original value
      }
    },
    [fromComponentValueToInput, fromInputToComponentValue],
  );

  const [componentValue, setComponentValue, isEqual] = useComponentValue<ComponentValueType>(
    entity,
    component,
    normalizeForComparison,
    tolerance,
  );
  const [input, setInput] = useState<InputType | null>(
    componentValue === null ? null : fromComponentValueToInput(componentValue),
  );
  const [focusedOn, setFocusedOn] = useState<string | null>(null);
  const skipSyncRef = useRef(false);
  const [isValid, setIsValid] = useState(true);

  const updateInputs = useCallback((value: InputType | null, skipSync = false) => {
    skipSyncRef.current = skipSync;
    setInput(value);
  }, []);

  const handleUpdate =
    (
      path: NestedKey<InputType>,
      getter: (event: React.ChangeEvent<HTMLInputElement>) => any = e => e.target.value,
    ) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (input === null) return;
      const newInputs = setValue(input, path, getter(event));
      updateInputs(newInputs);
    };

  const handleFocus = useCallback(
    (path: NestedKey<InputType>) => () => {
      setFocusedOn(path);
    },
    [],
  );

  const handleBlur = useCallback(() => {
    if (componentValue === null) return;
    setFocusedOn(null);
    updateInputs(fromComponentValueToInput(componentValue));
  }, [componentValue]);

  const validate = useCallback(
    (input: InputType | null): input is InputType => input !== null && validateInput(input),
    [input, ...deps],
  );

  // sync inputs -> engine
  useEffect(() => {
    if (skipSyncRef.current) return;
    if (validate(input)) {
      const newComponentValue = { ...componentValue, ...fromInputToComponentValue(input) };
      if (isEqual(newComponentValue)) return;

      setComponentValue(newComponentValue);
    }
  }, [input]);

  // sync engine -> inputs
  useEffect(() => {
    if (componentValue === null) return;

    let newInputs = fromComponentValueToInput(componentValue) as any;
    if (focusedOn) {
      // skip sync from state while editing, to avoid overriding the user input
      const current = getValue(input, focusedOn);
      newInputs = setValue(newInputs, focusedOn, current);
    }
    // set "skipSync" to avoid cyclic component value change
    updateInputs(newInputs, true);
  }, [componentValue, ...deps]);

  useEffect(() => {
    setIsValid(validate(input));
  }, [input, ...deps]);

  const getProps = useCallback(
    (
      path: NestedKey<InputType>,
      getter?: (event: React.ChangeEvent<HTMLInputElement>) => any,
    ): Pick<InputHTMLAttributes<HTMLElement>, 'value' | 'onChange' | 'onFocus' | 'onBlur'> => {
      const rawValue = getValue(input, path) || '';
      // Don't stringify arrays - return them as-is for multi-select components
      const displayValue = Array.isArray(rawValue) ? rawValue : rawValue.toString();

      return {
        value: displayValue,
        onChange: handleUpdate(path, getter),
        onFocus: handleFocus(path),
        onBlur: handleBlur,
      };
    },
    [handleUpdate, handleFocus, handleBlur, input],
  );

  return { getInputProps: getProps, isValid };
};

// Helper function to recursively merge values
const mergeValues = (values: any[]): any => {
  // Special case: if all values are arrays, find intersection
  if (values.every(val => Array.isArray(val))) {
    return intersection(values);
  }

  // Base case - if any value is not an object, compare directly
  if (!values.every(val => val && typeof val === 'object')) {
    return values.every(val => val === values[0]) ? values[0] : MIXED_VALUE;
  }

  // Get all keys from all objects
  const allKeys = [...new Set(values.flatMap(Object.keys))];

  // Create result object
  const result: any = {};

  // For each key, recursively merge values
  for (const key of allKeys) {
    const valuesForKey = values.map(obj => obj[key]);
    result[key] = mergeValues(valuesForKey);
  }

  return result;
};

const mergeComponentValues = <ComponentValueType extends object, InputType extends Input>(
  values: ComponentValueType[],
  fromComponentValueToInput: (componentValue: ComponentValueType) => InputType,
): InputType => {
  // Transform all component values to input format
  const inputs = values.map(fromComponentValueToInput);

  // Get first input as reference
  const firstInput = inputs[0];

  // Create result object with same shape as first input
  const result = {} as InputType;

  // For each key in first input
  for (const key in firstInput) {
    const valuesForKey = inputs.map(input => input[key]);
    result[key] = mergeValues(valuesForKey);
  }

  return result;
};

const getEntityAndComponentValue = <ComponentValueType extends object>(
  entities: Entity[],
  component: Component<ComponentValueType>,
): [Entity, ComponentValueType][] => {
  return entities.map(entity => [
    entity,
    getComponentValue(entity, component) as ComponentValueType,
  ]);
};

export const useMultiComponentInput = <ComponentValueType extends object, InputType extends Input>(
  entities: Entity[],
  component: Component<ComponentValueType>,
  fromComponentValueToInput: (componentValue: ComponentValueType) => InputType,
  fromInputToComponentValue: (input: InputType) => ComponentValueType,
  { validateInput = () => true, deps = [] }: UseComponentInputOptions<InputType> = {},
) => {
  // If there's only one entity, use the single entity version just to be safe for now
  if (entities.length === 1) {
    return useComponentInput(
      entities[0],
      component,
      fromComponentValueToInput,
      fromInputToComponentValue,
      {
        validateInput,
        deps,
      },
    );
  }
  const sdk = useSdk();

  // Get initial merged value from all entities
  const initialEntityValues = getEntityAndComponentValue(entities, component);
  const initialMergedValue = useMemo(
    () =>
      mergeComponentValues(
        initialEntityValues.map(([_, component]) => component),
        fromComponentValueToInput,
      ),
    [...deps], // recompute when deps change
  );

  const [value, setMergeValue] = useState(initialMergedValue);
  const [isValid, setIsValid] = useState(true);
  const [isFocused, setIsFocused] = useState(false);

  // Handle input updates
  const handleUpdate = useCallback(
    (
      path: NestedKey<InputType>,
      getter: (event: React.ChangeEvent<HTMLInputElement>) => any = e => e.target.value,
    ) =>
      (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!value) return;

        const newValue = setValue(value, path, getter(event));
        if (!hasDiff(value, newValue, 2)) return;

        // Only update if component is last-write-win and SDK exists
        if (!isLastWriteWinComponent(component) || !sdk) {
          setMergeValue(newValue);
          return;
        }

        // Validate and update all entities
        const entityUpdates = getEntityAndComponentValue(entities, component).map(
          ([entity, componentValue]) => {
            const updatedInput = setValue(
              fromComponentValueToInput(componentValue as any),
              path,
              getter(event),
            );
            const newComponentValue = fromInputToComponentValue(updatedInput);
            return {
              entity,
              value: newComponentValue,
              isValid: validateInput(updatedInput),
            };
          },
        );

        const allUpdatesValid = entityUpdates.every(({ isValid }) => isValid);

        if (allUpdatesValid) {
          entityUpdates.forEach(({ entity, value }) => {
            sdk.operations.updateValue(component, entity, value);
          });
          void sdk.operations.dispatch();
        }

        setMergeValue(newValue);
        setIsValid(allUpdatesValid);
      },
    [
      value,
      sdk,
      component,
      entities,
      fromInputToComponentValue,
      fromComponentValueToInput,
      validateInput,
    ],
  );

  // Sync with engine changes
  useChange(
    event => {
      const isRelevantUpdate =
        entities.includes(event.entity) &&
        component.componentId === event.component?.componentId &&
        event.value &&
        event.operation === CrdtMessageType.PUT_COMPONENT;

      if (!isRelevantUpdate) return;

      const updatedEntityValues = getEntityAndComponentValue(entities, component);
      const newMergedValue = mergeComponentValues(
        updatedEntityValues.map(([_, component]) => component),
        fromComponentValueToInput,
      );

      if (!hasDiff(value, newMergedValue, 2) || isFocused) return;

      setMergeValue(newMergedValue);
    },
    [entities, component, fromComponentValueToInput, value, isFocused, ...deps],
  );

  useEffect(() => {
    if (value) {
      setIsValid(validateInput(value));
    }
  }, [value, validateInput, ...deps]);

  // Input props getter
  const getInputProps = useCallback(
    (
      path: NestedKey<InputType>,
      getter?: (event: React.ChangeEvent<HTMLInputElement>) => any,
    ): Pick<InputHTMLAttributes<HTMLElement>, 'value' | 'onChange' | 'onFocus' | 'onBlur'> => {
      const rawValue = getValue(value, path) || '';
      // Don't stringify arrays - return them as-is for multi-select components
      const displayValue = Array.isArray(rawValue) ? rawValue : rawValue.toString();

      return {
        value: displayValue,
        onChange: handleUpdate(path, getter),
        onFocus: () => setIsFocused(true),
        onBlur: () => setIsFocused(false),
      };
    },
    [value, handleUpdate],
  );

  return { getInputProps, isValid };
};

/**
 * Item with its input props for list-based components
 */
export type ListItem<T> = {
  value: T;
  isPartial: boolean;
  inputProps: Pick<
    InputHTMLAttributes<HTMLElement>,
    'value' | 'onChange' | 'onFocus' | 'onBlur'
  > & {
    disabled: boolean;
  };
};

/**
 * Return type for list input hooks
 */
export type ListInputResult<ComponentValueType extends object, ItemType extends string> = {
  items: ListItem<ItemType>[];
  commonItems: ItemType[];
  partialItems: ItemType[];
  entityValuesMap: Map<Entity, ComponentValueType>;
  addItem: (item: ItemType) => void;
  removeItem: (item: ItemType) => void;
  isValid: boolean;
  isFocused: boolean;
};

/**
 * Gets entity and component values for list-based components
 */
const getEntityAndListComponentValue = <ComponentValueType extends object>(
  entities: Entity[],
  component: Component<ComponentValueType>,
): Map<Entity, ComponentValueType> => {
  const map = new Map<Entity, ComponentValueType>();
  entities.forEach(ent => {
    const value = getComponentValue(ent, component);
    if (value) map.set(ent, value as ComponentValueType);
  });
  return map;
};

/**
 * Merges list values from multiple entities into common and partial items
 */
const mergeListValues = <ComponentValueType extends object, ItemType extends string>(
  entityValuesMap: Map<Entity, ComponentValueType>,
  getItems: (componentValue: ComponentValueType) => ItemType[],
  entityCount: number,
): { commonItems: ItemType[]; partialItems: ItemType[] } => {
  const itemArrays = Array.from(entityValuesMap.values()).map(v => getItems(v));
  const { common, partial } = partitionByFrequency(itemArrays, entityCount);
  return {
    commonItems: common as ItemType[],
    partialItems: partial as ItemType[],
  };
};

/**
 * Hook for managing list-based component values across one or more entities.
 * Unlike useComponentInput/useMultiComponentInput which work with fixed paths,
 * this hook handles dynamic arrays where items can be added/removed.
 *
 * For single entity: all items are editable (delegates to simplified logic)
 * For multiple entities: common items (in ALL) are editable, partial items (in SOME) are disabled
 */
export const useComponentListInput = <ComponentValueType extends object, ItemType extends string>(
  entities: Entity[],
  component: Component<ComponentValueType>,
  getItems: (componentValue: ComponentValueType) => ItemType[],
  setItems: (items: ItemType[], currentValue: ComponentValueType) => ComponentValueType,
  validateItems: (items: ItemType[]) => boolean = () => true,
  deps: unknown[] = [],
): ListInputResult<ComponentValueType, ItemType> => {
  const sdk = useSdk();
  const isSingleEntity = entities.length === 1;

  // Memoize entities set for O(1) lookup instead of O(n) includes
  const entitiesSet = useMemo(() => new Set(entities), [entities]);

  // Get initial entity values
  const initialEntityValuesMap = getEntityAndListComponentValue(entities, component);

  // Get initial merged values
  const initialMergedValues = useMemo(() => {
    // For single entity, all items are "common" (editable)
    if (isSingleEntity) {
      const singleValue = initialEntityValuesMap.get(entities[0]);
      return {
        commonItems: singleValue ? getItems(singleValue) : ([] as ItemType[]),
        partialItems: [] as ItemType[],
      };
    }
    // For multiple entities, partition into common and partial
    return mergeListValues(initialEntityValuesMap, getItems, entities.length);
  }, [...deps]);

  const [value, setValue] = useState(initialMergedValues);
  const [entityValuesMap, setEntityValuesMap] =
    useState<Map<Entity, ComponentValueType>>(initialEntityValuesMap);
  const [isValid, setIsValid] = useState(true);
  const [isFocused, setIsFocused] = useState(false);

  // Local state for editing (to prevent focus loss during typing)
  const [localItems, setLocalItems] = useState<ItemType[]>(value.commonItems);

  // Pre-compute index map for O(1) lookup instead of O(n) indexOf
  const commonItemsIndexMap = useMemo(() => {
    const map = new Map<ItemType, number>();
    value.commonItems.forEach((item, index) => {
      map.set(item, index);
    });
    return map;
  }, [value.commonItems]);

  // Use refs for values used in handlers (to create stable handler references)
  const localItemsRef = useRef(localItems);
  const commonItemsIndexMapRef = useRef(commonItemsIndexMap);

  // Keep refs in sync with state
  useEffect(() => {
    localItemsRef.current = localItems;
  }, [localItems]);

  useEffect(() => {
    commonItemsIndexMapRef.current = commonItemsIndexMap;
  }, [commonItemsIndexMap]);

  // Stable handler using refs - prevents items array recalculation on every keystroke
  const handleItemChange = useCallback(
    (index: number) => (event: React.ChangeEvent<HTMLInputElement>) => {
      const currentLocalItems = localItemsRef.current;
      const newItemValue = event.target.value as ItemType;

      // Check if there's actually a diff
      if (currentLocalItems[index] === newItemValue) return;

      // Create new items array with the change
      const newLocalItems = [...currentLocalItems];
      newLocalItems[index] = newItemValue;

      // Only update if component is last-write-win and SDK exists
      if (!isLastWriteWinComponent(component) || !sdk) {
        setLocalItems(newLocalItems);
        return;
      }

      // Validate and update all entities
      const allUpdatesValid = validateItems(newLocalItems);

      if (allUpdatesValid) {
        const currentEntityValues = getEntityAndListComponentValue(entities, component);
        const currentIndexMap = commonItemsIndexMapRef.current;

        entities.forEach(entity => {
          const currentValue = currentEntityValues.get(entity) as ComponentValueType | undefined;
          if (!currentValue) return;

          const currentItems = getItems(currentValue);

          // For single entity, just use the new items directly
          // For multiple entities, map old common items to new local items using O(1) Map lookup
          const newItems = isSingleEntity
            ? newLocalItems
            : currentItems.map(oldItem => {
                const commonIndex = currentIndexMap.get(oldItem);
                if (commonIndex !== undefined && newLocalItems[commonIndex] !== undefined) {
                  return newLocalItems[commonIndex];
                }
                return oldItem; // Keep partial items unchanged
              });

          const newComponentValue = setItems(
            newItems as ItemType[],
            currentValue as ComponentValueType,
          );
          sdk.operations.updateValue(component as any, entity, newComponentValue);
        });
        void sdk.operations.dispatch();
      }

      setLocalItems(newLocalItems);
      setIsValid(allUpdatesValid);
    },
    [component, sdk, entities, isSingleEntity, getItems, setItems, validateItems],
  );

  // Handle blur - just unfocus (validation and SDK sync already happen in handleItemChange)
  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  // Handle focus
  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  // Sync with engine changes (similar to useMultiComponentInput)
  useChange(
    event => {
      // O(1) lookup instead of O(n) includes
      const isRelevantUpdate =
        entitiesSet.has(event.entity) &&
        component.componentId === event.component?.componentId &&
        event.value &&
        event.operation === CrdtMessageType.PUT_COMPONENT;

      if (!isRelevantUpdate) return;

      const updatedEntityValuesMap = getEntityAndListComponentValue(entities, component);

      // Get new merged values
      const newMergedValues = isSingleEntity
        ? {
            commonItems: updatedEntityValuesMap.get(entities[0])
              ? getItems(updatedEntityValuesMap.get(entities[0])!)
              : ([] as ItemType[]),
            partialItems: [] as ItemType[],
          }
        : mergeListValues(updatedEntityValuesMap, getItems, entities.length);

      // Always update entityValuesMap (other properties like defaultValue might have changed)
      setEntityValuesMap(updatedEntityValuesMap);

      // Check if items actually changed
      const hasItemsChanged =
        hasDiff(newMergedValues.commonItems, value.commonItems, 2) ||
        hasDiff(newMergedValues.partialItems, value.partialItems, 2);

      if (!hasItemsChanged) return;

      // Update value state (reflects SDK truth for items)
      setValue(newMergedValues);

      // Only update local items if not focused (to prevent losing edits while typing)
      if (!isFocused) {
        setLocalItems(newMergedValues.commonItems);
      }
    },
    [entities, entitiesSet, component, isSingleEntity, getItems, value, isFocused, ...deps],
  );

  // Validate items
  useEffect(() => {
    setIsValid(validateItems(localItems));
  }, [localItems, validateItems, ...deps]);

  // Add item to all entities
  const addItem = useCallback(
    (newItem: ItemType) => {
      if (!sdk) return;

      const currentEntityValues = getEntityAndListComponentValue(entities, component);

      entities.forEach(entity => {
        const currentValue = currentEntityValues.get(entity);
        if (!currentValue) return;

        const currentItems = getItems(currentValue);
        const newItems = [...currentItems, newItem];
        const newValue = setItems(newItems, currentValue);
        sdk.operations.updateValue(component as any, entity, newValue);
      });
      void sdk.operations.dispatch();
    },
    [entities, getItems, setItems, component, sdk],
  );

  // Remove item from all entities that have it
  const removeItem = useCallback(
    (itemToRemove: ItemType) => {
      if (!sdk) return;

      const currentEntityValues = getEntityAndListComponentValue(entities, component);

      entities.forEach(entity => {
        const currentValue = currentEntityValues.get(entity);
        if (!currentValue) return;

        const currentItems = getItems(currentValue);
        const newItems = currentItems.filter(item => item !== itemToRemove);

        if (newItems.length !== currentItems.length) {
          const newValue = setItems(newItems, currentValue);
          sdk.operations.updateValue(component as any, entity, newValue);
        }
      });
      void sdk.operations.dispatch();
    },
    [entities, getItems, setItems, component, sdk],
  );

  // Build items array with input props - stable handlers prevent recalculation on every keystroke
  const items: ListItem<ItemType>[] = useMemo(() => {
    const result: ListItem<ItemType>[] = [];

    // Common items (editable)
    localItems.forEach((item, index) => {
      result.push({
        value: item,
        isPartial: false,
        inputProps: {
          value: item,
          onChange: handleItemChange(index),
          onFocus: handleFocus,
          onBlur: handleBlur,
          disabled: false,
        },
      });
    });

    // Partial items (disabled) - only for multiple entities
    value.partialItems.forEach(item => {
      result.push({
        value: item,
        isPartial: true,
        inputProps: {
          value: item,
          onChange: undefined,
          onFocus: undefined,
          onBlur: undefined,
          disabled: true,
        },
      });
    });

    return result;
  }, [localItems, value.partialItems, handleItemChange, handleFocus, handleBlur]);

  return {
    items,
    commonItems: localItems,
    partialItems: value.partialItems,
    entityValuesMap,
    addItem,
    removeItem,
    isValid,
    isFocused,
  };
};
