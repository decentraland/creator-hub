import { describe, expect, it } from 'vitest';

import { coalesceRequiredAttr } from './required-attrs';

describe('coalesceRequiredAttr', () => {
  it("coalesces every required text attr with '' (required react-ecs string props)", () => {
    expect(coalesceRequiredAttr('Label', 'value', 'props.name')).toBe("props.name ?? ''");
    expect(coalesceRequiredAttr('Label', 'value', 'state.title')).toBe("state.title ?? ''");
    expect(coalesceRequiredAttr('Button', 'value', 'props.label')).toBe("props.label ?? ''");
    expect(coalesceRequiredAttr('Input', 'placeholder', 'props.hint')).toBe("props.hint ?? ''");
  });

  it('leaves a non-required attribute untouched', () => {
    expect(coalesceRequiredAttr('Label', 'color', 'props.c')).toBe('props.c');
    expect(coalesceRequiredAttr('Label', 'fontSize', 'props.size')).toBe('props.size');
    expect(coalesceRequiredAttr('Input', 'value', 'props.v')).toBe('props.v');
  });

  it('leaves value on an element without a required value untouched', () => {
    expect(coalesceRequiredAttr('UiEntity', 'value', 'props.x')).toBe('props.x');
    expect(coalesceRequiredAttr('Dropdown', 'value', 'props.x')).toBe('props.x');
  });
});
