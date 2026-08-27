import { describe, expect, it } from 'vitest';

import { hiddenUnderAbsoluteParent, visibleDisplayValue } from './PropertyPanel';

const RELATIVE = 0;
const ABSOLUTE = 1;
const FLEX = 0;

const inFlow = true;
const parentAbsolute = false;

describe('hiddenUnderAbsoluteParent', () => {
  it('should keep the row while the parent lays its children out', () => {
    expect(hiddenUnderAbsoluteParent(inFlow, null)).toBe(false);
    expect(hiddenUnderAbsoluteParent(inFlow, {})).toBe(false);
    expect(hiddenUnderAbsoluteParent(inFlow, { positionType: ABSOLUTE })).toBe(false);
  });

  it('should drop the row under an absolute parent, where there is no flow to leave', () => {
    expect(hiddenUnderAbsoluteParent(parentAbsolute, null)).toBe(true);
    expect(hiddenUnderAbsoluteParent(parentAbsolute, { positionType: RELATIVE })).toBe(true);
  });

  it('should keep the row on an already-absolute node, whatever the parent does', () => {
    expect(hiddenUnderAbsoluteParent(parentAbsolute, { positionType: ABSOLUTE })).toBe(false);
  });
});

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
