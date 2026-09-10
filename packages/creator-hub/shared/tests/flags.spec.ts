import { describe, expect, it } from 'vitest';
import { supportsUiDesigner } from '../flags';

describe('supportsUiDesigner', () => {
  it('accepts 7.26.0 and newer', () => {
    expect(supportsUiDesigner('7.26.0')).toBe(true);
    expect(supportsUiDesigner('7.26.4')).toBe(true);
    expect(supportsUiDesigner('7.27.0')).toBe(true);
    expect(supportsUiDesigner('8.0.0')).toBe(true);
  });

  it('rejects anything older than 7.26.0', () => {
    expect(supportsUiDesigner('7.25.0')).toBe(false);
    expect(supportsUiDesigner('7.20.4')).toBe(false);
    expect(supportsUiDesigner('6.99.99')).toBe(false);
  });

  it('rejects a missing version', () => {
    expect(supportsUiDesigner(null)).toBe(false);
    expect(supportsUiDesigner(undefined)).toBe(false);
    expect(supportsUiDesigner('')).toBe(false);
  });
});
