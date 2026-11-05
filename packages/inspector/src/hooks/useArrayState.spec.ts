import { act, renderHook } from '@testing-library/react';
import { useArrayState } from './useArrayState';

type Item = { a: number; b: number };

const initial: Item[] = [
  { a: 0, b: 0 },
  { a: 9, b: 9 },
];

describe('useArrayState', () => {
  describe('when two producers modify the same item before a re-render', () => {
    let result: { current: ReturnType<typeof useArrayState<Item>> };

    beforeEach(() => {
      ({ result } = renderHook(() => useArrayState<Item>(initial)));
      act(() => {
        const modify = result.current[2];
        modify(0, prev => ({ ...prev, a: 1 }));
        modify(0, prev => ({ ...prev, b: 2 }));
      });
    });

    it('should keep both edits', () => {
      expect(result.current[0][0]).toEqual({ a: 1, b: 2 });
    });

    it('should leave the other items untouched', () => {
      expect(result.current[0][1]).toEqual({ a: 9, b: 9 });
    });
  });

  describe('when an item is modified with a plain value', () => {
    let result: { current: ReturnType<typeof useArrayState<Item>> };

    beforeEach(() => {
      ({ result } = renderHook(() => useArrayState<Item>(initial)));
      act(() => {
        result.current[2](1, { a: 5, b: 6 });
      });
    });

    it('should replace that item', () => {
      expect(result.current[0]).toEqual([
        { a: 0, b: 0 },
        { a: 5, b: 6 },
      ]);
    });
  });

  describe('when a producer modification is given a callback', () => {
    let callback: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      vi.useFakeTimers();
      callback = vi.fn();
      const { result } = renderHook(() => useArrayState<Item>(initial));
      act(() => {
        result.current[2](0, prev => ({ ...prev, a: 3 }), callback);
      });
      vi.runAllTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should call it with the updated array', () => {
      expect(callback).toHaveBeenLastCalledWith([
        { a: 3, b: 0 },
        { a: 9, b: 9 },
      ]);
    });
  });
});
