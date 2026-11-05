import { useCallback, useEffect, useState } from 'react';
import { recursiveCheck } from '../lib/utils/deep-equal';

// `T` is always a plain data object here, so a function is unambiguously a producer.
export type ItemUpdate<T> = T | ((prev: T) => T);

export function useArrayState<T>(initialArray: T[] = []) {
  const [array, setArray] = useState<T[]>([...initialArray]);

  useEffect(() => {
    if (!recursiveCheck(initialArray, array, 2)) return;
    setArray([...initialArray]);
  }, [initialArray]);

  // Function to add an item to the array
  const addItem = useCallback(
    (item: T, callback?: (updatedArray: T[]) => void) => {
      setArray(prevArray => {
        const newArray = [...prevArray, item];
        if (callback) {
          setTimeout(() => callback(newArray), 0);
        }
        return newArray;
      });
    },
    [setArray],
  );

  // Modify an item by index. Pass a `(prev) => next` producer when several edits can land before a
  // re-render: it composes against the queued state, where a plain value built from the render
  // closure would overwrite the edit queued before it.
  const modifyItem = useCallback(
    (index: number, update: ItemUpdate<T>, callback?: (updatedArray: T[]) => void) => {
      setArray(prevArray => {
        const newArray = [...prevArray];
        newArray[index] =
          typeof update === 'function' ? (update as (prev: T) => T)(prevArray[index]) : update;
        if (callback) {
          // Use setTimeout to ensure the callback runs after the state update
          setTimeout(() => callback(newArray), 0);
        }
        return newArray;
      });
    },
    [setArray],
  );

  // Function to remove an item from the array by index
  const removeItem = useCallback(
    (index: number, callback?: (updatedArray: T[]) => void) => {
      setArray(prevArray => {
        const newArray = [...prevArray];
        newArray.splice(index, 1);
        if (callback) {
          setTimeout(() => callback(newArray), 0);
        }
        return newArray;
      });
    },
    [setArray],
  );

  return [array, addItem, modifyItem, removeItem, setArray] as const;
}
