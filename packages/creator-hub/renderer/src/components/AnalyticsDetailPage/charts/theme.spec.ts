import { describe, expect, it } from 'vitest';

import { percentTicks } from './theme';

describe('percentTicks', () => {
  describe('when the axis is a full 0-100 percentage', () => {
    it('should tick every quarter', () => {
      expect(percentTicks(100)).toEqual([0, 25, 50, 75, 100]);
    });
  });

  describe('when the axis is sized by its data', () => {
    it('should leave the ticks to the chart', () => {
      expect(percentTicks(undefined)).toBeUndefined();
      expect(percentTicks(25)).toBeUndefined();
    });
  });
});
