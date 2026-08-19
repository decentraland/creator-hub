import { describe, expect, it } from 'vitest';

import { buildGroups, type FieldConfig } from './field-configs';
import { isAddableField } from './PropertyPanel';

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
    expect(isAddableField(field('Button', 'Disabled'), null, NONE)).toBe(true);
    expect(isAddableField(field('Button', 'Disabled'), {}, NONE)).toBe(true);
  });

  it('should not offer one already set, even when set to the falsy default', () => {
    expect(isAddableField(field('Button', 'Disabled'), { disabled: false }, NONE)).toBe(false);
  });

  it('should never offer a core prop, which always has its own row', () => {
    expect(isAddableField(field('UiEntity', 'Size'), null, NONE)).toBe(false);
  });

  // Adding a bound prop would splice `disabled={true}` over `disabled={state.locked}`,
  // silently dropping the binding — the parser files a bound prop under the node's
  // bindings, so it is absent from the component value and looks unset here.
  it('should not offer a prop bound to a variable', () => {
    const disabled = field('Button', 'Disabled');
    expect(isAddableField(disabled, null, bound(disabled))).toBe(false);
    const inputDisabled = field('Input', 'Disabled');
    expect(isAddableField(inputDisabled, null, bound(inputDisabled))).toBe(false);
  });
});
