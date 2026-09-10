import { describe, expect, it } from 'vitest';

import { TEXT_ALIGN_MODES, splitTextAlign, textAlignMode } from './text-align';

const MODES_IN_ENUM_ORDER = [
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'middle-center',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

describe('splitTextAlign', () => {
  it('should split every mode into the pair the two selectors show', () => {
    for (const [mode, name] of MODES_IN_ENUM_ORDER.entries()) {
      const [v, h] = name.split('-');
      expect(splitTextAlign(mode)).toEqual({ vertical: v, horizontal: h });
    }
  });

  it('should read an unset prop as the in-world default of middle center', () => {
    expect(splitTextAlign(undefined)).toEqual({ vertical: 'middle', horizontal: 'center' });
  });

  it('should read an out-of-range value as the default', () => {
    expect(splitTextAlign(42)).toEqual({ vertical: 'middle', horizontal: 'center' });
    expect(splitTextAlign(-1)).toEqual({ vertical: 'middle', horizontal: 'center' });
  });
});

describe('textAlignMode', () => {
  it('should be the exact inverse of splitTextAlign', () => {
    for (const mode of MODES_IN_ENUM_ORDER.keys()) {
      expect(textAlignMode(splitTextAlign(mode))).toBe(mode);
    }
  });

  it('should reach all nine modes from the two selectors', () => {
    const reached = new Set<number>();
    for (const vertical of TEXT_ALIGN_MODES.vertical) {
      for (const horizontal of TEXT_ALIGN_MODES.horizontal) {
        reached.add(textAlignMode({ vertical, horizontal }));
      }
    }
    expect([...reached].sort((a, b) => a - b)).toEqual([...MODES_IN_ENUM_ORDER.keys()]);
  });
});
