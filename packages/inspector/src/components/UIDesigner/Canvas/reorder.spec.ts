import { describe, expect, it } from 'vitest';

import { flowFrom, insertionSlot } from './reorder';
import type { Box, Flow } from './reorder';

// Boxes are viewport px, exactly what getBoundingClientRect hands the canvas.
const box = (left: number, top: number, width: number, height: number): Box => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
});

const at = (x: number, y: number) => ({ x, y });

const ROW: Flow = { axis: 'x', reversed: false, wrap: 'nowrap' };

describe('flowFrom', () => {
  it('should read the axis and reversal off a computed flexDirection', () => {
    expect(flowFrom('row', 'nowrap')).toEqual({ axis: 'x', reversed: false, wrap: 'nowrap' });
    expect(flowFrom('row-reverse', 'nowrap')).toEqual({
      axis: 'x',
      reversed: true,
      wrap: 'nowrap',
    });
    expect(flowFrom('column', 'nowrap')).toEqual({ axis: 'y', reversed: false, wrap: 'nowrap' });
    expect(flowFrom('column-reverse', 'nowrap')).toEqual({
      axis: 'y',
      reversed: true,
      wrap: 'nowrap',
    });
  });

  it('should keep only the two wrapping values, so an unknown one reads as nowrap', () => {
    expect(flowFrom('row', 'wrap').wrap).toBe('wrap');
    expect(flowFrom('row', 'wrap-reverse').wrap).toBe('wrap-reverse');
    expect(flowFrom('row', 'revert-layer').wrap).toBe('nowrap');
  });
});

describe('insertionSlot', () => {
  describe('when dragging in a single-line row (A | B | C, dragging C)', () => {
    // Each child is 100x20; the parent is taller than its children so the
    // full-height indicator is distinguishable from a child's own extent.
    const siblings = [box(0, 0, 100, 20), box(100, 0, 100, 20)];
    const parent = box(0, 0, 300, 60);

    it('should hold its own slot while the drag stays past every sibling', () => {
      expect(insertionSlot(siblings, at(250, 10), ROW, parent).index).toBe(2);
    });

    it('should land between A and B once it crosses B midpoint (A | C | B)', () => {
      expect(insertionSlot(siblings, at(120, 10), ROW, parent).index).toBe(1);
    });

    it('should land at the head once it crosses A midpoint', () => {
      expect(insertionSlot(siblings, at(40, 10), ROW, parent).index).toBe(0);
    });

    it('should ignore the cross axis, so a purely vertical drag is a no-op', () => {
      // Siblings of differing heights are one line under nowrap — reading their
      // cross extents as line breaks would reorder on a sideways drag.
      const uneven = [box(0, 0, 100, 40), box(100, 0, 100, 20)];
      expect(insertionSlot(uneven, at(250, 200), ROW, parent).index).toBe(2);
      expect(insertionSlot(uneven, at(250, -200), ROW, parent).index).toBe(2);
    });

    it('should center the indicator in the gap it splits, spanning the parent', () => {
      const slot = insertionSlot(siblings, at(120, 10), ROW, parent);
      expect(slot).toEqual({ index: 1, main: 100, crossStart: 0, crossEnd: 60 });
    });

    it('should put the indicator at the leading edge of the first sibling', () => {
      expect(insertionSlot(siblings, at(40, 10), ROW, parent).main).toBe(0);
    });

    it('should put the indicator at the trailing edge of the last sibling', () => {
      expect(insertionSlot(siblings, at(250, 10), ROW, parent).main).toBe(200);
    });
  });

  describe('when dragging in a column', () => {
    const COLUMN: Flow = { axis: 'y', reversed: false, wrap: 'nowrap' };
    const siblings = [box(0, 0, 100, 20), box(0, 20, 100, 20)];
    const parent = box(0, 0, 100, 60);

    it('should count the siblings the drag has passed downwards', () => {
      expect(insertionSlot(siblings, at(50, 5), COLUMN, parent).index).toBe(0);
      expect(insertionSlot(siblings, at(50, 15), COLUMN, parent).index).toBe(1);
      expect(insertionSlot(siblings, at(50, 35), COLUMN, parent).index).toBe(2);
    });

    it('should orient the indicator across the parent width', () => {
      expect(insertionSlot(siblings, at(50, 15), COLUMN, parent)).toEqual({
        index: 1,
        main: 20,
        crossStart: 0,
        crossEnd: 100,
      });
    });
  });

  describe('when the row is reversed (source A | B | C renders C | B | A)', () => {
    const REVERSED: Flow = { axis: 'x', reversed: true, wrap: 'nowrap' };
    // Dragging C, the last in source, which renders leftmost.
    const siblings = [box(200, 0, 100, 20), box(100, 0, 100, 20)];
    const parent = box(0, 0, 300, 20);

    it('should insert at the head when dragged to the far end of the flow', () => {
      expect(insertionSlot(siblings, at(280, 10), REVERSED, parent).index).toBe(0);
    });

    it('should insert between the siblings when dropped between them', () => {
      expect(insertionSlot(siblings, at(150, 10), REVERSED, parent).index).toBe(1);
    });

    it('should place the indicator on the boundary the reversed gap sits at', () => {
      expect(insertionSlot(siblings, at(150, 10), REVERSED, parent).main).toBe(200);
    });
  });

  describe('when the row wraps (A B / C D on two lines, dragging D)', () => {
    const WRAP: Flow = { axis: 'x', reversed: false, wrap: 'wrap' };
    const siblings = [box(0, 0, 100, 20), box(100, 0, 100, 20), box(0, 20, 100, 20)];
    const parent = box(0, 0, 200, 40);

    it('should count every sibling on an earlier line whole', () => {
      // Start of line 2: past both of line 1, before C.
      expect(insertionSlot(siblings, at(20, 30), WRAP, parent).index).toBe(2);
    });

    it('should hold its own slot at the end of the last line', () => {
      expect(insertionSlot(siblings, at(150, 30), WRAP, parent).index).toBe(3);
    });

    it('should reach a slot on an earlier line by dragging onto that line', () => {
      // The main axis alone cannot express this: x=160 is past B on line 1, yet
      // the same x on line 2 is the last slot.
      expect(insertionSlot(siblings, at(160, 10), WRAP, parent).index).toBe(2);
      expect(insertionSlot(siblings, at(60, 10), WRAP, parent).index).toBe(1);
    });

    it('should not count a later line, so the head stays reachable', () => {
      expect(insertionSlot(siblings, at(10, 10), WRAP, parent).index).toBe(0);
    });

    it('should span only the dragged line, anchored where the drag is', () => {
      // Slot 2 straddles the wrap (end of line 1 == start of line 2): dragging on
      // line 2 draws at C's leading edge over line 2's height, not across both.
      expect(insertionSlot(siblings, at(20, 30), WRAP, parent)).toEqual({
        index: 2,
        main: 0,
        crossStart: 20,
        crossEnd: 40,
      });
      // The same slot reached from line 1 draws at that line's trailing edge.
      expect(insertionSlot(siblings, at(160, 10), WRAP, parent)).toEqual({
        index: 2,
        main: 200,
        crossStart: 0,
        crossEnd: 20,
      });
    });
  });

  describe('when a wrapped line mixes item heights (align-items: flex-start)', () => {
    const WRAP: Flow = { axis: 'x', reversed: false, wrap: 'wrap' };
    // Line 1 is 60 tall but its first item only 20 — the live scene's shape (a
    // Label beside a tall container). Line 2 starts below it.
    const siblings = [box(0, 0, 100, 20), box(100, 0, 100, 60), box(0, 60, 100, 20)];
    const parent = box(0, 0, 200, 80);

    it('should keep a short item on its line, so the slot before it stays reachable', () => {
      // y=40 is below the short item but still on line 1. Measured against its own
      // box it would read as an earlier line and be counted, making index 0
      // unreachable anywhere but the item's own 20px band.
      expect(insertionSlot(siblings, at(10, 40), WRAP, parent).index).toBe(0);
      expect(insertionSlot(siblings, at(60, 40), WRAP, parent).index).toBe(1);
    });

    it('should span the whole line, not the anchored item, when indicating', () => {
      expect(insertionSlot(siblings, at(10, 40), WRAP, parent)).toEqual({
        index: 0,
        main: 0,
        crossStart: 0,
        crossEnd: 60,
      });
    });

    it('should still separate the lines', () => {
      expect(insertionSlot(siblings, at(10, 70), WRAP, parent).index).toBe(2);
    });
  });

  describe('when the row wraps in reverse (line 1 sits below line 2)', () => {
    const WRAP_REVERSE: Flow = { axis: 'x', reversed: false, wrap: 'wrap-reverse' };
    // A B on the lower line (first in source), C on the upper one.
    const siblings = [box(0, 20, 100, 20), box(100, 20, 100, 20), box(0, 0, 100, 20)];
    const parent = box(0, 0, 200, 40);

    it('should treat the lower line as the earlier one', () => {
      expect(insertionSlot(siblings, at(20, 10), WRAP_REVERSE, parent).index).toBe(2);
      expect(insertionSlot(siblings, at(190, 30), WRAP_REVERSE, parent).index).toBe(2);
      expect(insertionSlot(siblings, at(60, 30), WRAP_REVERSE, parent).index).toBe(1);
    });
  });

  describe('when the node has no in-flow siblings', () => {
    it('should report the only slot there is', () => {
      const parent = box(10, 20, 100, 40);
      expect(insertionSlot([], at(50, 50), ROW, parent)).toEqual({
        index: 0,
        main: 10,
        crossStart: 20,
        crossEnd: 60,
      });
    });
  });
});
