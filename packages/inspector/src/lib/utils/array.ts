/**
 * Moves a node to a specific index
 * @param list array to mutate
 * @param from index of the node to move
 * @param to destination index
 */
export function move<T>(list: T[], from: number, to: number) {
  list.splice(to, 0, list.splice(from, 1)[0]);
}

/**
 * Pushes a value to a list only if the value is not already on the list
 * @param list array to update
 * @param value value to push
 * @returns updated list
 */
export function cleanPush<T extends number | string>(list: T[], value: T): T[] {
  return Array.from(new Set(list).add(value));
}

/**
 * Computes the intersection of multiple arrays (elements present in ALL arrays)
 * Uses Set for O(1) lookups - optimized by starting with smallest array
 * @param arrays array of arrays to find intersection
 * @returns array of elements present in all arrays
 */
export function intersection<T>(arrays: T[][]): T[] {
  if (arrays.length === 0) return [];
  if (arrays.length === 1) return [...arrays[0]];

  const sortedByLength = [...arrays].sort((a, b) => a.length - b.length);
  const smallest = sortedByLength[0];
  const otherSets = sortedByLength.slice(1).map(arr => new Set(arr));

  return smallest.filter(item => otherSets.every(set => set.has(item)));
}

/**
 * Computes the union of multiple arrays (all unique elements across arrays)
 * @param arrays array of arrays to find union
 * @returns array of all unique elements
 */
export function union<T>(arrays: T[][]): T[] {
  return [...new Set(arrays.flat())];
}

/**
 * Partitions elements by their frequency across arrays
 * Returns common (in ALL arrays) and partial (in SOME but not all)
 * @param arrays array of arrays to partition
 * @param frequency total number of arrays (used to determine if element is in all)
 * @returns object with common and partial arrays
 */
export function partitionByFrequency<T>(
  arrays: T[][],
  frequency: number,
): { common: T[]; partial: T[] } {
  const frequencyMap = new Map<T, number>();

  arrays.forEach(arr => {
    arr.forEach(item => {
      frequencyMap.set(item, (frequencyMap.get(item) ?? 0) + 1);
    });
  });

  const common: T[] = [];
  const partial: T[] = [];

  frequencyMap.forEach((count, item) => {
    if (count === frequency) {
      common.push(item);
    } else {
      partial.push(item);
    }
  });

  return { common, partial };
}

/**
 * Checks if all elements in an array are equal to each other.
 * Uses a selector function to extract the value to compare from each element.
 * @param array array to check
 * @param selector function to extract the value to compare from each element
 * @returns true if all elements are equal (or array has 0-1 elements)
 */
export function allEqual<T, V>(array: T[], selector: (item: T) => V): boolean {
  if (array.length <= 1) return true;
  const firstValue = selector(array[0]);
  return array.every(item => selector(item) === firstValue);
}

/**
 * Checks if all elements in an array match a specific value.
 * Uses a selector function to extract the value to compare from each element.
 * @param array array to check
 * @param selector function to extract the value to compare from each element
 * @param value the value to compare against
 * @returns true if all elements match the value (or array is empty)
 */
export function allEqualTo<T, V>(array: T[], selector: (item: T) => V, value: V): boolean {
  return array.every(item => selector(item) === value);
}
