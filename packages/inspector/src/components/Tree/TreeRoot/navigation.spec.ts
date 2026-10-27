import { describe, expect, it } from 'vitest';

import { navigate, type NavItem } from './navigation';

describe('navigate', () => {
  const items: NavItem[] = [
    { id: 'a', level: 1 },
    { id: 'b', level: 1, expanded: true },
    { id: 'b1', level: 2 },
    { id: 'b2', level: 2 },
    { id: 'c', level: 1, expanded: false },
    { id: 'd', level: 1 },
  ];

  describe('when Down or Up is pressed', () => {
    it('should focus the next row, and return null past the last', () => {
      expect(navigate(items, 'a', 'ArrowDown', false)).toEqual({ kind: 'focus', id: 'b' });
      expect(navigate(items, 'd', 'ArrowDown', false)).toBeNull();
    });

    it('should focus the previous row, and return null before the first', () => {
      expect(navigate(items, 'b', 'ArrowUp', false)).toEqual({ kind: 'focus', id: 'a' });
      expect(navigate(items, 'a', 'ArrowUp', false)).toBeNull();
    });
  });

  describe('when Home or End is pressed', () => {
    it('should focus the first and the last row', () => {
      expect(navigate(items, 'c', 'Home', false)).toEqual({ kind: 'focus', id: 'a' });
      expect(navigate(items, 'a', 'End', false)).toEqual({ kind: 'focus', id: 'd' });
    });
  });

  describe('when Right is pressed', () => {
    it('should open a closed parent', () => {
      expect(navigate(items, 'c', 'ArrowRight', false)).toEqual({
        kind: 'setOpen',
        id: 'c',
        open: true,
      });
    });

    it('should focus the first child of an open parent', () => {
      expect(navigate(items, 'b', 'ArrowRight', false)).toEqual({ kind: 'focus', id: 'b1' });
    });

    it('should do nothing on a leaf', () => {
      expect(navigate(items, 'd', 'ArrowRight', false)).toBeNull();
    });
  });

  describe('when Left is pressed', () => {
    it('should close an open parent', () => {
      expect(navigate(items, 'b', 'ArrowLeft', false)).toEqual({
        kind: 'setOpen',
        id: 'b',
        open: false,
      });
    });

    it('should focus the parent of a child', () => {
      expect(navigate(items, 'b2', 'ArrowLeft', false)).toEqual({ kind: 'focus', id: 'b' });
    });

    it('should do nothing on a top-level leaf', () => {
      expect(navigate(items, 'a', 'ArrowLeft', false)).toBeNull();
    });
  });

  describe('when Enter is pressed', () => {
    it('should select the row', () => {
      expect(navigate(items, 'b1', 'Enter', false)).toEqual({ kind: 'select', id: 'b1' });
    });
  });

  describe('when an unbound key is pressed', () => {
    it('should return null', () => {
      expect(navigate(items, 'a', 'x', false)).toBeNull();
      expect(navigate(items, 'a', ' ', false)).toBeNull();
      expect(navigate(items, 'a', 'Space', false)).toBeNull();
    });
  });

  describe('when Shift is held', () => {
    it('should extend to the next or previous row', () => {
      expect(navigate(items, 'a', 'ArrowDown', true)).toEqual({ kind: 'extend', id: 'b' });
      expect(navigate(items, 'b', 'ArrowUp', true)).toEqual({ kind: 'extend', id: 'a' });
    });

    it('should return null past the last row', () => {
      expect(navigate(items, 'd', 'ArrowDown', true)).toBeNull();
    });

    it('should not bind Home, End or Right', () => {
      expect(navigate(items, 'c', 'Home', true)).toBeNull();
      expect(navigate(items, 'a', 'End', true)).toBeNull();
      expect(navigate(items, 'c', 'ArrowRight', true)).toBeNull();
    });
  });
});
