import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { radioGroupKeyDown, radioTabIndex } from './radio-group';

const VALUES = ['a', 'b', 'c'] as const;
type V = (typeof VALUES)[number];

function group(): HTMLElement {
  const el = document.createElement('div');
  for (const _value of VALUES) el.appendChild(document.createElement('button'));
  document.body.appendChild(el);
  return el;
}

function press(el: HTMLElement, key: string, current: V) {
  const select = vi.fn();
  const preventDefault = vi.fn();
  const event = { key, currentTarget: el, preventDefault };
  radioGroupKeyDown(VALUES, current, select)(event as unknown as React.KeyboardEvent<HTMLElement>);
  return { select, preventDefault };
}

describe('the segmented control keyboard pattern', () => {
  describe('when an arrow key is pressed', () => {
    it('should select and focus the next segment on ArrowRight and ArrowDown', () => {
      for (const key of ['ArrowRight', 'ArrowDown']) {
        const el = group();
        expect(press(el, key, 'a').select).toHaveBeenCalledWith('b');
        expect(document.activeElement).toBe(el.children[1]);
      }
    });

    it('should select and focus the previous segment on ArrowLeft and ArrowUp', () => {
      for (const key of ['ArrowLeft', 'ArrowUp']) {
        const el = group();
        expect(press(el, key, 'c').select).toHaveBeenCalledWith('b');
        expect(document.activeElement).toBe(el.children[1]);
      }
    });

    it('should wrap around at both ends', () => {
      const el = group();
      expect(press(el, 'ArrowRight', 'c').select).toHaveBeenCalledWith('a');
      expect(press(el, 'ArrowLeft', 'a').select).toHaveBeenCalledWith('c');
    });
  });

  describe('when Home or End is pressed', () => {
    it('should jump to the first and last segment', () => {
      const el = group();
      expect(press(el, 'Home', 'b').select).toHaveBeenCalledWith('a');
      expect(press(el, 'End', 'b').select).toHaveBeenCalledWith('c');
      expect(document.activeElement).toBe(el.children[2]);
    });
  });

  describe('when any other key is pressed', () => {
    it('should leave it to the browser, so Tab still leaves the group', () => {
      const { select, preventDefault } = press(group(), 'Tab', 'a');
      expect(select).not.toHaveBeenCalled();
      expect(preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('when assigning the roving tabindex', () => {
    it('should make the selected segment the group’s only tab stop', () => {
      expect(VALUES.map((_, i) => radioTabIndex(VALUES, 'b', i))).toEqual([-1, 0, -1]);
    });

    it('should fall back to the first segment when nothing is selected', () => {
      expect(VALUES.map((_, i) => radioTabIndex(VALUES, 'z' as V, i))).toEqual([0, -1, -1]);
    });
  });
});
