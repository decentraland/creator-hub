import { describe, expect, it } from 'vitest';

import {
  YGPT_ABSOLUTE,
  YGPT_RELATIVE,
  YGU_POINT,
  YGU_UNDEFINED,
} from '../../../../lib/sdk/ui-transform-constants';
import {
  absolutePatch,
  FLOW_DIRECTIONS,
  flowPatch,
  flowValue,
  inFlowPatch,
  isFreeFlow,
  isWrapping,
  wrapPatch,
} from './flow';

describe('the Flow control', () => {
  describe('when reading the current cell', () => {
    it('reads free when no flexDirection is set, regardless of the node’s own positionType', () => {
      expect(flowValue({})).toBe('free');
      expect(flowValue(null)).toBe('free');
      expect(flowValue({ positionType: YGPT_ABSOLUTE })).toBe('free');
    });

    it('reads the flex direction when one is set', () => {
      expect(flowValue({ flexDirection: FLOW_DIRECTIONS.column })).toBe('column');
      expect(flowValue({ flexDirection: FLOW_DIRECTIONS['row-reverse'] })).toBe('row-reverse');
    });
  });

  describe('when picking a cell', () => {
    it('does nothing when the cell is already selected', () => {
      expect(flowPatch('free', 'free')).toBeNull();
      expect(flowPatch('row', 'row')).toBeNull();
    });

    it('clears flexDirection for free and never touches positionType', () => {
      const patch = flowPatch('free', 'column')!;
      expect('flexDirection' in patch).toBe(true);
      expect(patch.flexDirection).toBeUndefined();
      expect(patch).not.toHaveProperty('positionType');
    });

    it('sets flexDirection for a direction and never touches positionType', () => {
      expect(flowPatch('column', 'free')).toEqual({ flexDirection: FLOW_DIRECTIONS.column });
      expect(flowPatch('row-reverse', 'row')).toEqual({
        flexDirection: FLOW_DIRECTIONS['row-reverse'],
      });
    });
  });

  describe('isFreeFlow', () => {
    it('is free only when no flexDirection is set', () => {
      expect(isFreeFlow({})).toBe(true);
      expect(isFreeFlow(null)).toBe(true);
      expect(isFreeFlow({ flexDirection: FLOW_DIRECTIONS.row })).toBe(false);
    });
  });

  describe('when toggling wrap', () => {
    it('reads any non-zero flexWrap as wrapping', () => {
      expect(isWrapping({})).toBe(false);
      expect(isWrapping({ flexWrap: 0 })).toBe(false);
      expect(isWrapping({ flexWrap: 1 })).toBe(true);
      expect(isWrapping({ flexWrap: 2 })).toBe(true);
    });

    it('writes only flexWrap', () => {
      expect(wrapPatch(true)).toEqual({ flexWrap: 1 });
      expect(wrapPatch(false)).toEqual({ flexWrap: 0 });
    });
  });

  describe('the positionType patches (owned by the Ignore Layout Flow control)', () => {
    it('absolutePatch pins to the leading edges and clears the margins', () => {
      expect(absolutePatch()).toMatchObject({
        positionType: YGPT_ABSOLUTE,
        positionTop: 0,
        positionTopUnit: YGU_POINT,
        positionLeft: 0,
        positionLeftUnit: YGU_POINT,
        marginTopUnit: YGU_UNDEFINED,
        marginLeftUnit: YGU_UNDEFINED,
      });
    });

    it('inFlowPatch returns the node to relative and clears the baked offsets', () => {
      expect(inFlowPatch()).toMatchObject({
        positionType: YGPT_RELATIVE,
        positionTopUnit: YGU_UNDEFINED,
        positionLeftUnit: YGU_UNDEFINED,
      });
    });
  });
});
