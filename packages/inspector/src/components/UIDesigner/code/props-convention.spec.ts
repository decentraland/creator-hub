import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';

import { applyEdits } from './emit-adapter';
import {
  addPropsProperty,
  propTypeToTs,
  readPropsVariables,
  removePropsProperty,
  setPropsPropertyType,
} from './props-convention';

function program(source: string) {
  const r = parseSync('Card.tsx', source);
  expect(r.errors).toHaveLength(0);
  return r.program as any;
}

const NO_PROPS = `export function Card() {
  return <UiEntity />
}
`;

const WITH_PROPS = `export function Card(props: { title: string; count: number }) {
  return <Label value={props.title} />
}
`;

describe('readPropsVariables', () => {
  it('reads the inline props type literal', () => {
    expect(readPropsVariables(program(WITH_PROPS), 'Card')).toEqual([
      { name: 'title', type: 'string' },
      { name: 'count', type: 'number' },
    ]);
  });

  it('returns [] for a component with no props', () => {
    expect(readPropsVariables(program(NO_PROPS), 'Card')).toEqual([]);
  });
});

describe('addPropsProperty', () => {
  it('seeds the props parameter on a param-less component', () => {
    const next = applyEdits(
      NO_PROPS,
      addPropsProperty(program(NO_PROPS), NO_PROPS, 'Card', 'title', 'string'),
    );
    expect(next).toContain('function Card(props: { title: string })');
    expect(parseSync('Card.tsx', next).errors).toHaveLength(0);
    expect(readPropsVariables(program(next), 'Card')).toEqual([{ name: 'title', type: 'string' }]);
  });

  it('appends to an existing props type literal', () => {
    const next = applyEdits(
      WITH_PROPS,
      addPropsProperty(program(WITH_PROPS), WITH_PROPS, 'Card', 'active', 'boolean'),
    );
    expect(readPropsVariables(program(next), 'Card')).toEqual([
      { name: 'title', type: 'string' },
      { name: 'count', type: 'number' },
      { name: 'active', type: 'boolean' },
    ]);
    expect(parseSync('Card.tsx', next).errors).toHaveLength(0);
  });
});

describe('removePropsProperty / setPropsPropertyType', () => {
  it('removes a prop, absorbing a delimiter', () => {
    const next = applyEdits(WITH_PROPS, removePropsProperty(program(WITH_PROPS), 'Card', 'count'));
    expect(readPropsVariables(program(next), 'Card')).toEqual([{ name: 'title', type: 'string' }]);
    expect(parseSync('Card.tsx', next).errors).toHaveLength(0);
  });

  it('retypes a prop in place', () => {
    const next = applyEdits(
      WITH_PROPS,
      setPropsPropertyType(program(WITH_PROPS), 'Card', 'count', 'string'),
    );
    expect(readPropsVariables(program(next), 'Card')).toEqual([
      { name: 'title', type: 'string' },
      { name: 'count', type: 'string' },
    ]);
    expect(parseSync('Card.tsx', next).errors).toHaveLength(0);
  });

  it('returns [] for an unknown prop', () => {
    expect(removePropsProperty(program(WITH_PROPS), 'Card', 'nope')).toEqual([]);
    expect(setPropsPropertyType(program(WITH_PROPS), 'Card', 'nope', 'string')).toEqual([]);
  });
});

describe('callback-typed props', () => {
  it('reads a function-typed member as type "callback"', () => {
    const src = `export function Card(props: { title: string; onSave: (value?: string | number) => void }) {
  return <UiEntity />
}`;
    expect(readPropsVariables(program(src), 'Card')).toEqual([
      { name: 'title', type: 'string' },
      { name: 'onSave', type: 'callback' },
    ]);
  });

  it('reads a non-primitive non-function member as "unknown" (not coerced to string)', () => {
    const src = `export function Card(props: { style: { color: string } }) {
  return <UiEntity />
}`;
    expect(readPropsVariables(program(src), 'Card')).toEqual([{ name: 'style', type: 'unknown' }]);
  });

  it('propTypeToTs maps callback to the handler-shaped function type', () => {
    expect(propTypeToTs('callback')).toBe('(value?: string | number) => void');
    expect(propTypeToTs('string')).toBe('string');
  });

  it('declaring a callback prop splices a valid function type that round-trips', () => {
    const src = `export function Card(props: { title: string }) {
  return <UiEntity />
}`;
    const next = applyEdits(
      src,
      addPropsProperty(program(src), src, 'Card', 'onSave', propTypeToTs('callback')),
    );
    expect(next).toContain('onSave: (value?: string | number) => void');
    expect(readPropsVariables(program(next), 'Card')).toEqual([
      { name: 'title', type: 'string' },
      { name: 'onSave', type: 'callback' },
    ]);
  });
});
