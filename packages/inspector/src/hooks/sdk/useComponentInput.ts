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

export const useComponentInput = <ComponentValueType extends object, InputType extends Input>(
  entity: Entity,
  component: Component<ComponentValueType>,
  fromComponentValueToInput: (componentValue: ComponentValueType) => InputType,
  fromInputToComponentValue: (input: InputType) => ComponentValueType,
  validateInput: (input: InputType) => boolean = () => true,
  deps: unknown[] = [],
  tolerance: number = 2, // floating-point tolerance for comparisons (default: 2 decimal places)
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
  validateInput: (input: InputType) => boolean = () => true,
  deps: unknown[] = [],
) => {
  // If there's only one entity, use the single entity version just to be safe for now
  if (entities.length === 1) {
    return useComponentInput(
      entities[0],
      component,
      fromComponentValueToInput,
      fromInputToComponentValue,
      validateInput,
      deps,
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
 * Supports both string items and object items (when keyExtractor is provided)
 */
export type ListInputResult<ComponentValueType extends object, ItemType> = {
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
 * Supports both string items and object items (when keyExtractor is provided)
 */
const mergeListValues = <ComponentValueType extends object, ItemType>(
  entityValuesMap: Map<Entity, ComponentValueType>,
  getItems: (componentValue: ComponentValueType) => ItemType[],
  entityCount: number,
  keyExtractor?: (item: ItemType) => string,
): { commonItems: ItemType[]; partialItems: ItemType[] } => {
  const itemArrays = Array.from(entityValuesMap.values()).map(v => getItems(v));

  // For object items, partition by extracted keys
  if (keyExtractor) {
    const keyArrays = itemArrays.map(items => items.map(keyExtractor));
    const { common: commonKeys, partial: partialKeys } = partitionByFrequency(
      keyArrays,
      entityCount,
    );
    const commonKeysSet = new Set(commonKeys);
    const partialKeysSet = new Set(partialKeys);

    // Get first array's items as reference for common items (all entities have them)
    const firstItems = itemArrays[0] || [];
    const commonItems = firstItems.filter(item => commonKeysSet.has(keyExtractor(item)));

    // For partial items, collect unique items by key from all arrays
    const partialItemsMap = new Map<string, ItemType>();
    itemArrays.forEach(items => {
      items.forEach(item => {
        const key = keyExtractor(item);
        if (partialKeysSet.has(key) && !partialItemsMap.has(key)) {
          partialItemsMap.set(key, item);
        }
      });
    });

    return {
      commonItems,
      partialItems: Array.from(partialItemsMap.values()),
    };
  }

  // For string items, use direct partitioning
  const { common, partial } = partitionByFrequency(itemArrays as string[][], entityCount);
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
 *
 * @param keyExtractor - Optional function to extract a string key from object items.
 *                       When provided, items are compared by their extracted keys instead of direct equality.
 *                       This enables support for object items (like Actions) in addition to string items.
 */
export const useComponentListInput = <ComponentValueType extends object, ItemType>(
  entities: Entity[],
  component: Component<ComponentValueType>,
  getItems: (componentValue: ComponentValueType) => ItemType[],
  setItems: (items: ItemType[], currentValue: ComponentValueType) => ComponentValueType,
  validateItems: (items: ItemType[]) => boolean = () => true,
  deps: unknown[] = [],
  keyExtractor?: (item: ItemType) => string,
): ListInputResult<ComponentValueType, ItemType> => {
  const sdk = useSdk();
  const isSingleEntity = entities.length === 1;

  // Memoize entities array by content (not reference) to prevent unnecessary re-renders
  // when parent passes a new array with same entities (e.g., [entity] on each render)
  const entitiesKey = entities.join(',');
  const stableEntities = useMemo(() => entities, [entitiesKey]);

  // Memoize entities set for O(1) lookup instead of O(n) includes
  const entitiesSet = useMemo(() => new Set(stableEntities), [stableEntities]);

  // Get initial entity values
  const initialEntityValuesMap = getEntityAndListComponentValue(stableEntities, component);

  // Get initial merged values
  const initialMergedValues = useMemo(() => {
    // For single entity, all items are "common" (editable)
    if (isSingleEntity) {
      const singleValue = initialEntityValuesMap.get(stableEntities[0]);
      return {
        commonItems: singleValue ? getItems(singleValue) : ([] as ItemType[]),
        partialItems: [] as ItemType[],
      };
    }
    // For multiple entities, partition into common and partial
    return mergeListValues(initialEntityValuesMap, getItems, stableEntities.length, keyExtractor);
  }, [...deps]);

  const [value, setValue] = useState(initialMergedValues);
  const [entityValuesMap, setEntityValuesMap] =
    useState<Map<Entity, ComponentValueType>>(initialEntityValuesMap);
  const [isValid, setIsValid] = useState(true);
  const [isFocused, setIsFocused] = useState(false);

  // Local state for editing (to prevent focus loss during typing)
  const [localItems, setLocalItems] = useState<ItemType[]>(value.commonItems);

  // Pre-compute index map for O(1) lookup instead of O(n) indexOf
  // For object items with keyExtractor, map by key; for strings, map by value
  const commonItemsIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    value.commonItems.forEach((item, index) => {
      const key = keyExtractor ? keyExtractor(item) : (item as string);
      map.set(key, index);
    });
    return map;
  }, [value.commonItems, keyExtractor]);

  // Use refs for values used in handlers (to create stable handler references)
  const localItemsRef = useRef(localItems);
  const commonItemsIndexMapRef = useRef(commonItemsIndexMap);
  const valueRef = useRef(value);
  const isFocusedRef = useRef(isFocused);

  // Keep refs in sync with state
  useEffect(() => {
    localItemsRef.current = localItems;
  }, [localItems]);

  useEffect(() => {
    commonItemsIndexMapRef.current = commonItemsIndexMap;
  }, [commonItemsIndexMap]);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    isFocusedRef.current = isFocused;
  }, [isFocused]);

  // Stable handler using refs - prevents items array recalculation on every keystroke
  // For string items: updates the string value directly
  // For object items: updates the key property (via keyExtractor) of the object
  const handleItemChange = useCallback(
    (index: number) => (event: React.ChangeEvent<HTMLInputElement>) => {
      const currentLocalItems = localItemsRef.current;
      const newValue = event.target.value;

      // For object items, we need to update the key property
      // For string items, we replace the value directly
      let newItemValue: ItemType;
      if (keyExtractor) {
        // For objects, create a new object with updated key
        // The keyExtractor tells us which property is the key (e.g., 'name' for Actions)
        const currentItem = currentLocalItems[index];
        const currentKey = keyExtractor(currentItem);
        if (currentKey === newValue) return; // No change
        // Create shallow copy with updated key property
        // We assume the key property name can be derived from the item structure
        newItemValue = { ...currentItem } as ItemType;
        // Find and update the key property by checking which property matches the current key
        for (const prop in newItemValue) {
          if ((newItemValue as any)[prop] === currentKey) {
            (newItemValue as any)[prop] = newValue;
            break;
          }
        }
      } else {
        newItemValue = newValue as ItemType;
        // Check if there's actually a diff for string items
        if (currentLocalItems[index] === newItemValue) return;
      }

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
        const currentEntityValues = getEntityAndListComponentValue(stableEntities, component);
        const currentIndexMap = commonItemsIndexMapRef.current;

        stableEntities.forEach(entity => {
          const currentValue = currentEntityValues.get(entity) as ComponentValueType | undefined;
          if (!currentValue) return;

          const currentItems = getItems(currentValue);

          // For single entity, just use the new items directly
          // For multiple entities, map old common items to new local items using O(1) Map lookup
          const newItems = isSingleEntity
            ? newLocalItems
            : currentItems.map(oldItem => {
                const oldKey = keyExtractor ? keyExtractor(oldItem) : (oldItem as string);
                const commonIndex = currentIndexMap.get(oldKey);
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
    [
      component,
      sdk,
      stableEntities,
      isSingleEntity,
      getItems,
      setItems,
      validateItems,
      keyExtractor,
    ],
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
  // Using refs for value and isFocused to avoid re-subscribing on every state change
  useChange(
    event => {
      // O(1) lookup instead of O(n) includes
      const isRelevantUpdate =
        entitiesSet.has(event.entity) &&
        component.componentId === event.component?.componentId &&
        event.value &&
        event.operation === CrdtMessageType.PUT_COMPONENT;

      if (!isRelevantUpdate) return;

      const updatedEntityValuesMap = getEntityAndListComponentValue(stableEntities, component);

      // Get new merged values
      const newMergedValues = isSingleEntity
        ? {
            commonItems: updatedEntityValuesMap.get(stableEntities[0])
              ? getItems(updatedEntityValuesMap.get(stableEntities[0])!)
              : ([] as ItemType[]),
            partialItems: [] as ItemType[],
          }
        : mergeListValues(updatedEntityValuesMap, getItems, stableEntities.length, keyExtractor);

      // Check if items actually changed (use ref to avoid stale closure)
      const currentValue = valueRef.current;
      const hasItemsChanged =
        hasDiff(newMergedValues.commonItems, currentValue.commonItems, 2) ||
        hasDiff(newMergedValues.partialItems, currentValue.partialItems, 2);

      if (!hasItemsChanged) return;

      // Update entityValuesMap and value state together (only when items changed)
      setEntityValuesMap(updatedEntityValuesMap);
      setValue(newMergedValues);

      // Only update local items if not focused (to prevent losing edits while typing)
      if (!isFocusedRef.current) {
        setLocalItems(newMergedValues.commonItems);
      }
    },
    [stableEntities, entitiesSet, component, isSingleEntity, getItems, keyExtractor, ...deps],
  );

  // Validate items
  useEffect(() => {
    setIsValid(validateItems(localItems));
  }, [localItems, validateItems, ...deps]);

  // Add item to all entities
  const addItem = useCallback(
    (newItem: ItemType) => {
      if (!sdk) return;

      const currentEntityValues = getEntityAndListComponentValue(stableEntities, component);

      stableEntities.forEach(entity => {
        const currentValue = currentEntityValues.get(entity);
        if (!currentValue) return;

        const currentItems = getItems(currentValue);
        const newItems = [...currentItems, newItem];
        const newValue = setItems(newItems, currentValue);
        sdk.operations.updateValue(component as any, entity, newValue);
      });
      void sdk.operations.dispatch();
    },
    [stableEntities, getItems, setItems, component, sdk],
  );

  // Remove item from all entities that have it
  // For object items with keyExtractor, compare by key; for strings, compare by value
  const removeItem = useCallback(
    (itemToRemove: ItemType) => {
      if (!sdk) return;

      const keyToRemove = keyExtractor ? keyExtractor(itemToRemove) : (itemToRemove as string);
      const currentEntityValues = getEntityAndListComponentValue(stableEntities, component);

      stableEntities.forEach(entity => {
        const currentValue = currentEntityValues.get(entity);
        if (!currentValue) return;

        const currentItems = getItems(currentValue);
        const newItems = currentItems.filter(item => {
          const itemKey = keyExtractor ? keyExtractor(item) : (item as string);
          return itemKey !== keyToRemove;
        });

        if (newItems.length !== currentItems.length) {
          const newValue = setItems(newItems, currentValue);
          sdk.operations.updateValue(component as any, entity, newValue);
        }
      });
      void sdk.operations.dispatch();
    },
    [stableEntities, getItems, setItems, component, sdk, keyExtractor],
  );

  // Build items array with input props - stable handlers prevent recalculation on every keystroke
  // For object items with keyExtractor, inputProps.value is the extracted key (for text input display)
  const items: ListItem<ItemType>[] = useMemo(() => {
    const result: ListItem<ItemType>[] = [];

    // Common items (editable)
    localItems.forEach((item, index) => {
      const displayValue = keyExtractor ? keyExtractor(item) : (item as string);
      result.push({
        value: item,
        isPartial: false,
        inputProps: {
          value: displayValue,
          onChange: handleItemChange(index),
          onFocus: handleFocus,
          onBlur: handleBlur,
          disabled: false,
        },
      });
    });

    // Partial items (disabled) - only for multiple entities
    value.partialItems.forEach(item => {
      const displayValue = keyExtractor ? keyExtractor(item) : (item as string);
      result.push({
        value: item,
        isPartial: true,
        inputProps: {
          value: displayValue,
          onChange: undefined,
          onFocus: undefined,
          onBlur: undefined,
          disabled: true,
        },
      });
    });

    return result;
  }, [localItems, value.partialItems, handleItemChange, handleFocus, handleBlur, keyExtractor]);

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
