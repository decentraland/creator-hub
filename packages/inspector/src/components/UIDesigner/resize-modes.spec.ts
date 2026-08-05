import { describe, expect, it } from 'vitest';

import {
  crossAxisOf,
  fillOwnsProp,
  fillsAxis,
  mainAxisFor,
  resizeMode,
  resizeModesFor,
  resizePatch,
  resizeValuePatch,
  type ResizeAxis,
  type ResizeMode,
} from './resize-modes';

// YGUnit / YGAlign / YGPositionType / YGFlexDirection values used below.
const POINT = 1;
const PERCENT = 2;
const AUTO = 3;
const STRETCH = 4;
const ABSOLUTE = 1;
const ROW = 0;
const COLUMN = 1;
const COLUMN_REVERSE = 2;
const ROW_REVERSE = 3;

// A patch reaching source: `undefined` means "remove this key" (the splice layer
// treats it that way — see uiTransformPatchFields), so re-reading a patched
// transform has to delete rather than store the undefined.
function applyPatch(
  transform: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...transform };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete next[key];
    else next[key] = value;
  }
  return next;
}

describe('mainAxisFor', () => {
  it('should map a row direction to width and a column direction to height', () => {
    expect(mainAxisFor(ROW)).toBe('width');
    expect(mainAxisFor(ROW_REVERSE)).toBe('width');
    expect(mainAxisFor(COLUMN)).toBe('height');
    expect(mainAxisFor(COLUMN_REVERSE)).toBe('height');
  });

  // Reverse flips the direction ALONG the axis, not which axis it is — the
  // mistake that would make Fill write flexGrow for the wrong dimension.
  it('should treat an unknown direction as a row, matching the PB default', () => {
    expect(mainAxisFor(99)).toBe('width');
  });

  it('should pair each axis with the other one', () => {
    expect(crossAxisOf('width')).toBe('height');
    expect(crossAxisOf('height')).toBe('width');
  });
});

describe('resizeMode', () => {
  describe('when the axis carries a length of its own', () => {
    it('should read the unit as the mode', () => {
      expect(resizeMode({ width: 100, widthUnit: POINT }, 'width', 'width')).toBe('fixed');
      expect(resizeMode({ width: 50, widthUnit: PERCENT }, 'width', 'width')).toBe('percent');
      expect(resizeMode({ width: 0, widthUnit: AUTO }, 'width', 'width')).toBe('hug');
    });
  });

  describe('when nothing is authored', () => {
    // Yoga's own default is closer to auto, but Hug disables the number input —
    // a fresh node would then have an uneditable size until its mode was changed.
    it('should read as Fixed, like every other unset length field', () => {
      expect(resizeMode({}, 'width', 'width')).toBe('fixed');
      expect(resizeMode(null, 'height', 'width')).toBe('fixed');
    });
  });

  describe('when the axis is filling', () => {
    it('should read flexGrow as Fill on the main axis only', () => {
      expect(resizeMode({ flexGrow: 1 }, 'width', 'width')).toBe('fill');
      expect(resizeMode({ flexGrow: 1 }, 'height', 'width')).toBe('fixed');
    });

    it('should read a stretch alignSelf as Fill on the cross axis only', () => {
      expect(resizeMode({ alignSelf: STRETCH }, 'height', 'width')).toBe('fill');
      expect(resizeMode({ alignSelf: STRETCH }, 'width', 'width')).toBe('fixed');
    });

    // A column parent swaps which prop owns which dimension — getting this
    // backwards is the whole reason the parent's direction has to be read.
    it('should follow the parent direction, not a fixed dimension', () => {
      expect(resizeMode({ flexGrow: 1 }, 'height', 'height')).toBe('fill');
      expect(resizeMode({ alignSelf: STRETCH }, 'width', 'height')).toBe('fill');
    });
  });

  describe('when a fill signal cannot actually take effect', () => {
    // Yoga honours an explicit size over both flexGrow and stretch, so showing
    // Fill here would claim a behaviour the node does not have.
    it('should not read Fill on an axis that already has a size', () => {
      expect(resizeMode({ flexGrow: 1, width: 100, widthUnit: POINT }, 'width', 'width')).toBe(
        'fixed',
      );
      expect(
        resizeMode({ alignSelf: STRETCH, height: 8, heightUnit: AUTO }, 'height', 'width'),
      ).toBe('hug');
    });

    it('should not read Fill on an absolute node, where Yoga ignores both props', () => {
      const absolute = { positionType: ABSOLUTE };
      expect(resizeMode({ ...absolute, flexGrow: 1 }, 'width', 'width')).toBe('fixed');
      expect(resizeMode({ ...absolute, alignSelf: STRETCH }, 'height', 'width')).toBe('fixed');
    });

    // The binary Fill mode means "grow to fill"; a share of 2 is a value it
    // cannot express, which is what keeps the raw Flex grow row reachable.
    it('should not read a flexGrow share other than 1 as Fill', () => {
      expect(resizeMode({ flexGrow: 2 }, 'width', 'width')).toBe('fixed');
      expect(resizeMode({ flexGrow: 0 }, 'width', 'width')).toBe('fixed');
    });

    it('should not read a non-stretch alignSelf as Fill', () => {
      expect(resizeMode({ alignSelf: 2 }, 'height', 'width')).toBe('fixed');
    });
  });
});

describe('resizeModesFor', () => {
  it('should offer every mode to a node in flow', () => {
    expect(resizeModesFor({})).toEqual(['fixed', 'percent', 'hug', 'fill']);
  });

  // Yoga applies flexGrow / alignSelf only to a node in flow, so Fill would be a
  // mode that does nothing. `auto` IS honoured on an absolute node, so Hug stays.
  it('should withhold Fill from an absolute node but keep Hug', () => {
    expect(resizeModesFor({ positionType: ABSOLUTE })).toEqual(['fixed', 'percent', 'hug']);
  });
});

describe('resizePatch', () => {
  describe('when entering Fill', () => {
    it('should clear the axis size and grow along the parent main axis', () => {
      expect(
        resizePatch({
          next: 'fill',
          current: 'fixed',
          axis: 'width',
          mainAxis: 'width',
          value: 100,
        }),
      ).toEqual({ width: undefined, widthUnit: undefined, flexGrow: 1 });
    });

    it('should stretch on the cross axis, where flexGrow would do nothing', () => {
      expect(
        resizePatch({
          next: 'fill',
          current: 'fixed',
          axis: 'height',
          mainAxis: 'width',
          value: 100,
        }),
      ).toEqual({ height: undefined, heightUnit: undefined, alignSelf: STRETCH });
    });
  });

  describe('when leaving Fill', () => {
    it('should clear the prop that axis borrowed and write the new length', () => {
      expect(
        resizePatch({
          next: 'fixed',
          current: 'fill',
          axis: 'width',
          mainAxis: 'width',
          value: 24,
        }),
      ).toEqual({ flexGrow: undefined, width: 24, widthUnit: POINT });
      expect(
        resizePatch({
          next: 'percent',
          current: 'fill',
          axis: 'height',
          mainAxis: 'width',
          value: 40,
        }),
      ).toEqual({ alignSelf: undefined, height: 40, heightUnit: PERCENT });
    });

    it('should clear only the prop belonging to THAT axis', () => {
      const patch = resizePatch({
        next: 'hug',
        current: 'fill',
        axis: 'width',
        mainAxis: 'width',
        value: 0,
      });
      expect(patch).toHaveProperty('flexGrow', undefined);
      expect(patch).not.toHaveProperty('alignSelf');
    });
  });

  // Clearing the fill props on every mode change would destroy a hand-authored
  // `alignSelf: 'center'` the moment the user touched the width dropdown.
  describe('when the axis was not filling', () => {
    it('should touch neither flexGrow nor alignSelf', () => {
      for (const next of ['fixed', 'percent', 'hug'] as ResizeMode[]) {
        const patch = resizePatch({
          next,
          current: 'percent',
          axis: 'width',
          mainAxis: 'width',
          value: 1,
        });
        expect(Object.keys(patch)).toEqual(['width', 'widthUnit']);
      }
    });
  });

  describe('and the mode is read back from the patched transform', () => {
    const MODES: ResizeMode[] = ['fixed', 'percent', 'hug', 'fill'];

    // The round trip the dropdown depends on: after a pick, a reparse must
    // classify the node as the mode the user picked, on both axes and under both
    // parent directions.
    it('should classify every transition as the mode that was picked', () => {
      for (const mainAxis of ['width', 'height'] as ResizeAxis[]) {
        for (const axis of ['width', 'height'] as ResizeAxis[]) {
          for (const current of MODES) {
            for (const next of MODES) {
              const before = applyPatch(
                {},
                resizePatch({ next: current, current: 'fixed', axis, mainAxis, value: 10 }),
              );
              expect(resizeMode(before, axis, mainAxis), `seeding ${current}`).toBe(current);
              const after = applyPatch(
                before,
                resizePatch({ next, current, axis, mainAxis, value: 10 }),
              );
              expect(resizeMode(after, axis, mainAxis), `${current} → ${next}`).toBe(next);
            }
          }
        }
      }
    });

    it('should keep the mode when only the number changes', () => {
      for (const mode of ['fixed', 'percent'] as ResizeMode[]) {
        const t = applyPatch({}, resizeValuePatch('width', mode, 12));
        expect(resizeMode(t, 'width', 'width')).toBe(mode);
        expect(t.width).toBe(12);
      }
    });
  });
});

describe('fillOwnsProp', () => {
  // Fill writes flexGrow / alignSelf, so their own rows must disappear exactly
  // while it is showing — otherwise one value has two live controls.
  it('should claim flexGrow while the main axis fills', () => {
    expect(fillOwnsProp('flexGrow', { flexGrow: 1 }, ROW)).toBe(true);
    expect(fillOwnsProp('flexGrow', { flexGrow: 1 }, COLUMN)).toBe(true);
  });

  it('should claim alignSelf while the cross axis fills', () => {
    expect(fillOwnsProp('alignSelf', { alignSelf: STRETCH }, ROW)).toBe(true);
    expect(fillOwnsProp('alignSelf', { alignSelf: STRETCH }, COLUMN)).toBe(true);
  });

  // The states Fill cannot show. Each must leave its raw row on screen, or the
  // value would live in source with nothing displaying it.
  it('should release a value the Fill mode cannot express', () => {
    expect(fillOwnsProp('flexGrow', { flexGrow: 2 }, ROW)).toBe(false);
    expect(fillOwnsProp('alignSelf', { alignSelf: 2 }, ROW)).toBe(false);
    expect(fillOwnsProp('flexGrow', { flexGrow: 1, width: 10, widthUnit: POINT }, ROW)).toBe(false);
    expect(fillOwnsProp('flexGrow', { flexGrow: 1, positionType: ABSOLUTE }, ROW)).toBe(false);
  });

  it('should claim nothing else', () => {
    expect(fillOwnsProp('flexShrink', { flexGrow: 1 }, ROW)).toBe(false);
    expect(fillOwnsProp('alignItems', { alignSelf: STRETCH }, ROW)).toBe(false);
  });

  // Same predicate the dropdown reads, so the row gate cannot drift from it.
  it('should agree with fillsAxis', () => {
    const t = { flexGrow: 1 };
    expect(fillOwnsProp('flexGrow', t, ROW)).toBe(fillsAxis(t, 'width', 'width'));
  });
});
