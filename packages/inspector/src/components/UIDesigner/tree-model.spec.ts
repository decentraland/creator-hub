import { describe, expect, it } from 'vitest';

import { classifyNode, previewBoundText } from './tree-model';

describe('classifyNode', () => {
  it('classifies a UiEntity with a background texture as an Image', () => {
    const uiBackground = { texture: { tex: { $case: 'texture', texture: { src: 'a.png' } } } };
    expect(classifyNode({ type: 'UiEntity', uiBackground })).toBe('Image');
  });

  it('classifies a UiEntity with an avatar texture as an Image', () => {
    const uiBackground = {
      texture: { tex: { $case: 'avatarTexture', avatarTexture: { userId: 'u' } } },
    };
    expect(classifyNode({ type: 'UiEntity', uiBackground })).toBe('Image');
  });

  it('classifies a UiEntity without a texture as a Container', () => {
    expect(classifyNode({ type: 'UiEntity' })).toBe('Container');
    expect(classifyNode({ type: 'UiEntity', uiBackground: { color: { r: 1 } } })).toBe('Container');
  });

  it('classifies every other type as itself', () => {
    expect(classifyNode({ type: 'Label' })).toBe('Label');
    expect(classifyNode({ type: 'Dropdown' })).toBe('Dropdown');
  });
});

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
