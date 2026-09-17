import { describe, expect, it } from 'vitest';

import { buildGroups, type FieldConfig } from './field-configs';
import { buildAddPatch, isAddableField, isInlineStub } from './PropertyPanel';

function field(type: 'Button' | 'Input', label: string): FieldConfig {
  const found = buildGroups(type)
    .flatMap(g => g.fields as FieldConfig[])
    .find(f => f.label === label);
  expect(found).toBeDefined();
  return found!;
}

const NONE: ReadonlySet<string> = new Set();
const bound = (field: FieldConfig) => new Set([`${field.componentId}.${field.path}`]);

describe('when bucketing a field into `+ Add property`', () => {
  it("should offer an optional prop the source doesn't author", () => {
    expect(isAddableField(field('Input', 'Placeholder Colour'), null, NONE)).toBe(true);
    expect(isAddableField(field('Input', 'Placeholder Colour'), {}, NONE)).toBe(true);
  });

  it('should not offer one already set, even when set to the falsy default', () => {
    expect(
      isAddableField(field('Input', 'Placeholder Colour'), { placeholderColor: null }, NONE),
    ).toBe(false);
  });

  it('should never offer a core prop, which always has its own row', () => {
    expect(isAddableField(field('UiEntity', 'Size'), null, NONE)).toBe(false);
  });

  it('should not offer a prop bound to a variable', () => {
    const placeholderColour = field('Input', 'Placeholder Colour');
    expect(isAddableField(placeholderColour, null, NONE)).toBe(true);
    expect(isAddableField(placeholderColour, null, bound(placeholderColour))).toBe(false);
  });
});

describe('when bucketing an inline-addable field', () => {
  it('should keep it out of the `+ Add property` menu whether set or not', () => {
    const minSize = field('UiEntity', 'Min Size');
    expect(minSize.inlineAdd).toBe(true);
    expect(isAddableField(minSize, null, NONE)).toBe(false);
    expect(isAddableField(minSize, { minWidth: 20 }, NONE)).toBe(false);
  });

  it('should show its stub only while the source leaves it unauthored', () => {
    const maxSize = field('UiEntity', 'Max Size');
    expect(isInlineStub(maxSize, null)).toBe(true);
    expect(isInlineStub(maxSize, {})).toBe(true);
    expect(isInlineStub(maxSize, { maxWidth: 100 })).toBe(false);
  });

  it('should never show a stub for a field that is not inline-addable', () => {
    expect(isInlineStub(field('Input', 'Placeholder Colour'), null)).toBe(false);
    expect(isInlineStub(field('UiEntity', 'Size'), null)).toBe(false);
  });

  it('should seed Border with a visible weight, not just a colour', () => {
    const border = field('UiEntity', 'Border');
    const patch = buildAddPatch(border);
    expect(patch.borderTopColor).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    expect(patch.borderTopWidth).toBe(1);
    expect(patch.borderLeftWidth).toBe(1);
  });
});
