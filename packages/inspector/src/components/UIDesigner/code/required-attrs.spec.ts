import { describe, expect, it } from 'vitest';

import { coalesceRequiredAttr } from './required-attrs';

describe('coalesceRequiredAttr', () => {
  it("coalesces a Label value binding with '' (value is a required string)", () => {
    expect(coalesceRequiredAttr('Label', 'value', 'props.name')).toBe("props.name ?? ''");
    expect(coalesceRequiredAttr('Label', 'value', 'state.title')).toBe("state.title ?? ''");
  });

  it('leaves a non-required Label attribute untouched', () => {
    expect(coalesceRequiredAttr('Label', 'color', 'props.c')).toBe('props.c');
    expect(coalesceRequiredAttr('Label', 'fontSize', 'props.size')).toBe('props.size');
  });

  it('leaves value on a non-Label element untouched', () => {
    expect(coalesceRequiredAttr('UiEntity', 'value', 'props.x')).toBe('props.x');
    expect(coalesceRequiredAttr('Input', 'value', 'props.x')).toBe('props.x');
  });
});
