import { describe, expect, it } from 'vitest';

import { overflowFlags, overflowPatch, type OverflowFlag } from './overflow-flags';

const VISIBLE = 0;
const HIDDEN = 1;
const SCROLL = 2;

const flagsOf = (overflow?: number) => overflowFlags(overflow === undefined ? {} : { overflow });

describe('overflowFlags', () => {
  it('should read the three enum values as the two boxes', () => {
    expect(flagsOf(VISIBLE)).toEqual({ scroll: false, clip: false, clipLocked: false });
    expect(flagsOf(HIDDEN)).toEqual({ scroll: false, clip: true, clipLocked: false });
    expect(flagsOf(SCROLL)).toEqual({ scroll: true, clip: true, clipLocked: true });
  });

  it('should read an unset prop as Yoga’s visible', () => {
    expect(flagsOf()).toEqual({ scroll: false, clip: false, clipLocked: false });
    expect(overflowFlags(null).clip).toBe(false);
  });

  it('should lock Clip on only while Scroll is on', () => {
    expect(flagsOf(SCROLL).clipLocked).toBe(true);
    expect(flagsOf(HIDDEN).clipLocked).toBe(false);
    expect(flagsOf(VISIBLE).clipLocked).toBe(false);
  });
});

describe('overflowPatch', () => {
  it('should reach all three enum values', () => {
    const reached = new Set<number>();
    for (const from of [VISIBLE, HIDDEN, SCROLL]) {
      for (const flag of ['scroll', 'clip'] as OverflowFlag[]) {
        for (const on of [true, false]) {
          reached.add(overflowPatch(flag, on, { overflow: from }).overflow as number);
        }
      }
    }
    expect([...reached].sort()).toEqual([VISIBLE, HIDDEN, SCROLL]);
  });

  it('should turn scrolling on and off', () => {
    expect(overflowPatch('scroll', true, { overflow: VISIBLE })).toEqual({ overflow: SCROLL });
    expect(overflowPatch('scroll', true, {})).toEqual({ overflow: SCROLL });
  });

  it('should leave clipping on when scrolling is turned off', () => {
    expect(overflowPatch('scroll', false, { overflow: SCROLL })).toEqual({ overflow: HIDDEN });
  });

  it('should toggle clipping on a node that is not scrolling', () => {
    expect(overflowPatch('clip', true, { overflow: VISIBLE })).toEqual({ overflow: HIDDEN });
    expect(overflowPatch('clip', false, { overflow: HIDDEN })).toEqual({ overflow: VISIBLE });
  });

  it('should round-trip every value through its own boxes', () => {
    for (const overflow of [VISIBLE, HIDDEN, SCROLL]) {
      const { scroll, clip } = overflowFlags({ overflow });
      expect(overflowPatch('scroll', scroll, { overflow }).overflow).toBe(overflow);
      if (!scroll) expect(overflowPatch('clip', clip, { overflow }).overflow).toBe(overflow);
    }
  });

  it('should always write an explicit value, never remove the prop', () => {
    for (const flag of ['scroll', 'clip'] as OverflowFlag[]) {
      for (const on of [true, false]) {
        expect(overflowPatch(flag, on, {}).overflow).toEqual(expect.any(Number));
      }
    }
  });
});
