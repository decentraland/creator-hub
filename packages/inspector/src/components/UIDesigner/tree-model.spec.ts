import { describe, expect, it } from 'vitest';

import { previewBoundText } from './tree-model';

describe('previewBoundText', () => {
  const KEY = 'core::UiText.value';

  it('returns the static value when the field has no binding row', () => {
    expect(previewBoundText(undefined, KEY, 'Label')).toBe('Label');
    expect(previewBoundText([{ field: 'other', variable: 'x' }], KEY, 'Label')).toBe('Label');
  });

  it('composes mixed-content segments with [name] placeholders for bindings', () => {
    const bindings = [
      {
        field: KEY,
        variable: '',
        segments: [
          { kind: 'literal', value: 'Hola ' },
          { kind: 'binding', value: 'inputValue' },
          { kind: 'literal', value: '!!!' },
        ],
      },
    ];
    expect(previewBoundText(bindings, KEY, 'Label')).toBe('Hola [inputValue]!!!');
  });

  it('renders a whole-field binding as [name]', () => {
    expect(previewBoundText([{ field: KEY, variable: 'playerName' }], KEY, 'Label')).toBe(
      '[playerName]',
    );
  });

  it('resolves a bound variable to its default value when a resolver is given', () => {
    const resolve = (expr: string) => (expr === 'state.name' ? 'John' : undefined);
    expect(previewBoundText([{ field: KEY, variable: 'state.name' }], KEY, 'Label', resolve)).toBe(
      'John',
    );
  });

  it('resolves each binding segment of a mixed-content row', () => {
    const resolve = (expr: string) => (expr === 'state.name' ? 'John' : undefined);
    const bindings = [
      {
        field: KEY,
        variable: '',
        segments: [
          { kind: 'literal', value: 'Hello: ' },
          { kind: 'binding', value: 'state.name' },
        ],
      },
    ];
    expect(previewBoundText(bindings, KEY, 'Label', resolve)).toBe('Hello: John');
  });

  it('falls back to [expr] when the resolver has no value (e.g. a marker)', () => {
    const resolve = () => undefined;
    expect(previewBoundText([{ field: KEY, variable: 'score' }], KEY, 'Label', resolve)).toBe(
      '[score]',
    );
  });
});
