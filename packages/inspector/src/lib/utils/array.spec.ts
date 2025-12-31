import { describe, it, expect, beforeEach } from 'vitest';

import {
  move,
  cleanPush,
  intersection,
  union,
  partitionByFrequency,
  allEqual,
  allEqualTo,
} from './array';

describe('when using move', () => {
  let list: number[];

  beforeEach(() => {
    list = [1, 2, 3, 4, 5];
  });

  describe('and moving an element forward', () => {
    beforeEach(() => {
      move(list, 1, 3);
    });

    it('should move the element to the new position', () => {
      expect(list).toEqual([1, 3, 4, 2, 5]);
    });
  });

  describe('and moving an element backward', () => {
    beforeEach(() => {
      move(list, 3, 1);
    });

    it('should move the element to the new position', () => {
      expect(list).toEqual([1, 4, 2, 3, 5]);
    });
  });

  describe('and moving to the same position', () => {
    beforeEach(() => {
      move(list, 2, 2);
    });

    it('should keep the list unchanged', () => {
      expect(list).toEqual([1, 2, 3, 4, 5]);
    });
  });
});

describe('when using cleanPush', () => {
  describe('and pushing a value that does not exist', () => {
    let list: number[];
    let result: number[];

    beforeEach(() => {
      list = [1, 2, 3];
      result = cleanPush(list, 4);
    });

    it('should add the value to the list', () => {
      expect(result).toEqual([1, 2, 3, 4]);
    });

    it('should not mutate the original list', () => {
      expect(list).toEqual([1, 2, 3]);
    });
  });

  describe('and pushing a value that already exists', () => {
    let list: number[];
    let result: number[];

    beforeEach(() => {
      list = [1, 2, 3];
      result = cleanPush(list, 2);
    });

    it('should not add a duplicate value', () => {
      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe('and pushing to an empty list', () => {
    let list: string[];
    let result: string[];

    beforeEach(() => {
      list = [];
      result = cleanPush(list, 'first');
    });

    it('should add the value to the empty list', () => {
      expect(result).toEqual(['first']);
    });
  });
});

describe('when using intersection', () => {
  describe('and there are no arrays', () => {
    let result: number[];

    beforeEach(() => {
      result = intersection([]);
    });

    it('should return an empty array', () => {
      expect(result).toEqual([]);
    });
  });

  describe('and there is only one array', () => {
    let arrays: number[][];
    let result: number[];

    beforeEach(() => {
      arrays = [[1, 2, 3]];
      result = intersection(arrays);
    });

    it('should return a copy of the array', () => {
      expect(result).toEqual([1, 2, 3]);
    });

    it('should not return the same reference', () => {
      expect(result).not.toBe(arrays[0]);
    });
  });

  describe('and there are multiple arrays with common elements', () => {
    let arrays: number[][];
    let result: number[];

    beforeEach(() => {
      arrays = [
        [1, 2, 3, 4],
        [2, 3, 4, 5],
        [3, 4, 5, 6],
      ];
      result = intersection(arrays);
    });

    it('should return only elements present in all arrays', () => {
      expect(result).toEqual([3, 4]);
    });
  });

  describe('and there are no common elements', () => {
    let arrays: number[][];
    let result: number[];

    beforeEach(() => {
      arrays = [
        [1, 2],
        [3, 4],
        [5, 6],
      ];
      result = intersection(arrays);
    });

    it('should return an empty array', () => {
      expect(result).toEqual([]);
    });
  });

  describe('and arrays have different sizes', () => {
    let arrays: string[][];
    let result: string[];

    beforeEach(() => {
      arrays = [
        ['a', 'b', 'c', 'd', 'e'],
        ['b', 'c'],
        ['a', 'b', 'c', 'd'],
      ];
      result = intersection(arrays);
    });

    it('should optimize by starting with the smallest array', () => {
      expect(result).toEqual(['b', 'c']);
    });
  });
});

describe('when using union', () => {
  describe('and there are no arrays', () => {
    let result: number[];

    beforeEach(() => {
      result = union([]);
    });

    it('should return an empty array', () => {
      expect(result).toEqual([]);
    });
  });

  describe('and there are multiple arrays', () => {
    let arrays: number[][];
    let result: number[];

    beforeEach(() => {
      arrays = [
        [1, 2, 3],
        [3, 4, 5],
        [5, 6, 7],
      ];
      result = union(arrays);
    });

    it('should return all unique elements', () => {
      expect(result).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });
  });

  describe('and arrays have duplicate elements', () => {
    let arrays: string[][];
    let result: string[];

    beforeEach(() => {
      arrays = [
        ['a', 'a', 'b'],
        ['b', 'b', 'c'],
      ];
      result = union(arrays);
    });

    it('should remove duplicates', () => {
      expect(result).toEqual(['a', 'b', 'c']);
    });
  });
});

describe('when using partitionByFrequency', () => {
  describe('and all elements are common', () => {
    let arrays: string[][];
    let result: { common: string[]; partial: string[] };

    beforeEach(() => {
      arrays = [
        ['a', 'b', 'c'],
        ['a', 'b', 'c'],
        ['a', 'b', 'c'],
      ];
      result = partitionByFrequency(arrays, 3);
    });

    it('should return all elements as common', () => {
      expect(result.common).toEqual(['a', 'b', 'c']);
    });

    it('should return no partial elements', () => {
      expect(result.partial).toEqual([]);
    });
  });

  describe('and all elements are partial', () => {
    let arrays: string[][];
    let result: { common: string[]; partial: string[] };

    beforeEach(() => {
      arrays = [['a'], ['b'], ['c']];
      result = partitionByFrequency(arrays, 3);
    });

    it('should return no common elements', () => {
      expect(result.common).toEqual([]);
    });

    it('should return all elements as partial', () => {
      expect(result.partial).toEqual(['a', 'b', 'c']);
    });
  });

  describe('and there are both common and partial elements', () => {
    let arrays: string[][];
    let result: { common: string[]; partial: string[] };

    beforeEach(() => {
      arrays = [
        ['a', 'b', 'x'],
        ['a', 'b', 'y'],
        ['a', 'b', 'z'],
      ];
      result = partitionByFrequency(arrays, 3);
    });

    it('should return common elements correctly', () => {
      expect(result.common).toEqual(['a', 'b']);
    });

    it('should return partial elements correctly', () => {
      expect(result.partial).toEqual(['x', 'y', 'z']);
    });
  });

  describe('and there are empty arrays', () => {
    let arrays: number[][];
    let result: { common: number[]; partial: number[] };

    beforeEach(() => {
      arrays = [[], [], []];
      result = partitionByFrequency(arrays, 3);
    });

    it('should return empty common array', () => {
      expect(result.common).toEqual([]);
    });

    it('should return empty partial array', () => {
      expect(result.partial).toEqual([]);
    });
  });
});

describe('when using allEqual', () => {
  describe('and the array is empty', () => {
    let array: number[];
    let result: boolean;

    beforeEach(() => {
      array = [];
      result = allEqual(array, item => item);
    });

    it('should return true', () => {
      expect(result).toBe(true);
    });
  });

  describe('and the array has one element', () => {
    let array: number[];
    let result: boolean;

    beforeEach(() => {
      array = [42];
      result = allEqual(array, item => item);
    });

    it('should return true', () => {
      expect(result).toBe(true);
    });
  });

  describe('and all elements have the same selected value', () => {
    let array: { id: number; name: string }[];
    let result: boolean;

    beforeEach(() => {
      array = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Alice' },
        { id: 3, name: 'Alice' },
      ];
      result = allEqual(array, item => item.name);
    });

    it('should return true', () => {
      expect(result).toBe(true);
    });
  });

  describe('and elements have different selected values', () => {
    let array: { id: number; name: string }[];
    let result: boolean;

    beforeEach(() => {
      array = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
        { id: 3, name: 'Alice' },
      ];
      result = allEqual(array, item => item.name);
    });

    it('should return false', () => {
      expect(result).toBe(false);
    });
  });

  describe('and using undefined values', () => {
    let array: { value?: string }[];
    let result: boolean;

    beforeEach(() => {
      array = [{ value: undefined }, {}, { value: undefined }];
      result = allEqual(array, item => item.value);
    });

    it('should return true when all undefined', () => {
      expect(result).toBe(true);
    });
  });
});

describe('when using allEqualTo', () => {
  describe('and the array is empty', () => {
    let array: number[];
    let result: boolean;

    beforeEach(() => {
      array = [];
      result = allEqualTo(array, item => item, 5);
    });

    it('should return true', () => {
      expect(result).toBe(true);
    });
  });

  describe('and all elements match the target value', () => {
    let array: { status: string }[];
    let result: boolean;

    beforeEach(() => {
      array = [{ status: 'active' }, { status: 'active' }, { status: 'active' }];
      result = allEqualTo(array, item => item.status, 'active');
    });

    it('should return true', () => {
      expect(result).toBe(true);
    });
  });

  describe('and some elements do not match the target value', () => {
    let array: { status: string }[];
    let result: boolean;

    beforeEach(() => {
      array = [{ status: 'active' }, { status: 'inactive' }, { status: 'active' }];
      result = allEqualTo(array, item => item.status, 'active');
    });

    it('should return false', () => {
      expect(result).toBe(false);
    });
  });

  describe('and no elements match the target value', () => {
    let array: { count: number }[];
    let result: boolean;

    beforeEach(() => {
      array = [{ count: 1 }, { count: 2 }, { count: 3 }];
      result = allEqualTo(array, item => item.count, 5);
    });

    it('should return false', () => {
      expect(result).toBe(false);
    });
  });

  describe('and checking for null value', () => {
    let array: { value: string | null }[];
    let result: boolean;

    beforeEach(() => {
      array = [{ value: null }, { value: null }, { value: null }];
      result = allEqualTo(array, item => item.value, null);
    });

    it('should return true when all values are null', () => {
      expect(result).toBe(true);
    });
  });

  describe('and using nested property selector', () => {
    let array: { user: { role: string } }[];
    let result: boolean;

    beforeEach(() => {
      array = [
        { user: { role: 'admin' } },
        { user: { role: 'admin' } },
        { user: { role: 'admin' } },
      ];
      result = allEqualTo(array, item => item.user.role, 'admin');
    });

    it('should return true when all nested values match', () => {
      expect(result).toBe(true);
    });
  });
});
