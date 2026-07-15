import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';

import { applyEdits } from './emit-adapter';
import {
  addStateProperty,
  literalForType,
  readStateVariables,
  removeStateProperty,
  setStatePropertyType,
  setStatePropertyValue,
} from './state-convention';

// These helpers take the raw ESTree PROGRAM (not the codeToUINodes tree the
// parse-adapter spec's `parse()` returns), so obtain it via parseSync directly.
const prog = (source: string) => parseSync('State.tsx', source).program as any;

describe('when reading the typed state convention', () => {
  it('should read variables typed by the interface', () => {
    expect(
      readStateVariables(
        prog('export interface State { score: number }\nexport const state: State = { score: 0 }'),
      ),
    ).toEqual([{ name: 'score', type: 'number', value: 0 }]);
  });

  it('should infer variable types from literal initializers when untyped', () => {
    expect(readStateVariables(prog("export const state = { name: 'hi', on: true }"))).toEqual([
      { name: 'name', type: 'string', value: 'hi' },
      { name: 'on', type: 'boolean', value: true },
    ]);
  });
});

describe('when writing a new state property', () => {
  it('should add to a non-empty object and its interface', () => {
    const src =
      'export interface State { score: number }\nexport const state: State = { score: 0 }';
    const next = applyEdits(src, addStateProperty(prog(src), 'lives', 'number'));
    expect(readStateVariables(prog(next))).toEqual([
      { name: 'score', type: 'number', value: 0 },
      { name: 'lives', type: 'number', value: 0 },
    ]);
  });

  it('should seed the first property of an empty object + interface', () => {
    const src = 'export interface State {}\nexport const state: State = {}';
    const next = applyEdits(src, addStateProperty(prog(src), 'score', 'number'));
    expect(readStateVariables(prog(next))).toEqual([{ name: 'score', type: 'number', value: 0 }]);
  });

  it('should write into the object even when no interface types it', () => {
    const src = 'export const state = { score: 0 }';
    const next = applyEdits(src, addStateProperty(prog(src), 'name', 'string'));
    expect(readStateVariables(prog(next)).map(v => v.name)).toContain('name');
  });

  it('should return [] when there is no state object to write into', () => {
    expect(addStateProperty(prog('const x = 1'), 'y', 'number')).toEqual([]);
  });
});

describe('when removing a state property', () => {
  it('should remove one of several variables from the object and interface', () => {
    const src =
      'export interface State { score: number\n  lives: number }\nexport const state: State = { score: 0, lives: 3 }';
    const next = applyEdits(src, removeStateProperty(prog(src), 'score'));
    expect(readStateVariables(prog(next))).toEqual([{ name: 'lives', type: 'number', value: 3 }]);
  });

  it('should remove the last remaining variable, emptying the object (no dangling comma)', () => {
    const src = 'export interface State {}\nexport const state: State = {}';
    const seeded = applyEdits(src, addStateProperty(prog(src), 'score', 'number'));
    const next = applyEdits(seeded, removeStateProperty(prog(seeded), 'score'));
    expect(readStateVariables(prog(next))).toEqual([]);
    // Reparses cleanly (a leftover trailing comma would be a syntax error).
    expect(parseSync('State.tsx', next).errors).toHaveLength(0);
  });

  it('should return [] when the variable is absent', () => {
    expect(removeStateProperty(prog('export const state = { a: 0 }'), 'missing')).toEqual([]);
  });
});

describe('when changing a state property type', () => {
  it('should rewrite the interface type and reset the initializer to the new default', () => {
    const src =
      'export interface State { score: number }\nexport const state: State = { score: 0 }';
    const next = applyEdits(src, setStatePropertyType(prog(src), 'score', 'boolean'));
    expect(readStateVariables(prog(next))).toEqual([
      { name: 'score', type: 'boolean', value: false },
    ]);
    expect(next).toContain('score: false');
  });

  it('should reset the initializer even when no interface types the state', () => {
    const src = 'export const state = { label: 0 }';
    const next = applyEdits(src, setStatePropertyType(prog(src), 'label', 'string'));
    expect(next).toContain("label: ''");
  });
});

describe('when reading and writing default values', () => {
  it('should read the statically-evaluated default value of each variable', () => {
    const src = "export const state = { score: 5, name: 'John', on: true, neg: -3, dyn: getX() }";
    expect(readStateVariables(prog(src))).toEqual([
      { name: 'score', type: 'number', value: 5 },
      { name: 'name', type: 'string', value: 'John' },
      { name: 'on', type: 'boolean', value: true },
      { name: 'neg', type: 'number', value: -3 },
      { name: 'dyn', type: 'string', value: undefined },
    ]);
  });

  it('should seed a new variable with a provided default', () => {
    const src = 'export interface State {}\nexport const state: State = {}';
    const next = applyEdits(src, addStateProperty(prog(src), 'name', 'string', 'John'));
    expect(next).toContain('name: "John"');
    expect(readStateVariables(prog(next))).toEqual([
      { name: 'name', type: 'string', value: 'John' },
    ]);
  });

  it('should splice a new default value onto an existing variable', () => {
    const src = "export const state = { name: '' }";
    const next = applyEdits(src, setStatePropertyValue(prog(src), 'name', 'string', 'Alice'));
    expect(next).toContain('name: "Alice"');
  });

  it('should format literals per type', () => {
    expect(literalForType('number', '42')).toBe('42');
    expect(literalForType('number', 'nope')).toBe('0');
    expect(literalForType('boolean', 'true')).toBe('true');
    expect(literalForType('boolean', 'x')).toBe('false');
    expect(literalForType('string', 'hi')).toBe('"hi"');
    expect(literalForType('string', '')).toBe("''");
  });
});
