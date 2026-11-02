import { describe, expect, it } from 'vitest';

import { visibleDisplayValue } from './PropertyPanel';

const FLEX = 0;

describe('visibleDisplayValue', () => {
  it('should remove the prop at base', () => {
    expect(visibleDisplayValue('base')).toBeUndefined();
  });

  it('should write flex explicitly in an override layer', () => {
    for (const layer of ['hover', 'press', 'active'] as const) {
      expect(visibleDisplayValue(layer)).toBe(FLEX);
    }
  });
});
