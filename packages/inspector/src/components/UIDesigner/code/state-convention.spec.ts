import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';

import { applyEdits } from './emit-adapter';
import { addStateProperty, readStateVariables } from './state-convention';

// These helpers take the raw ESTree PROGRAM (not the codeToUINodes tree the
// parse-adapter spec's `parse()` returns), so obtain it via parseSync directly.
const prog = (source: string) => parseSync('State.tsx', source).program as any;

describe('when reading the typed state convention', () => {
  it('should read variables typed by the interface', () => {
    expect(
      readStateVariables(
        prog('export interface State { score: number }\nexport const state: State = { score: 0 }'),
      ),
    ).toEqual([{ name: 'score', type: 'number' }]);
  });

  it('should infer variable types from literal initializers when untyped', () => {
    expect(readStateVariables(prog("export const state = { name: 'hi', on: true }"))).toEqual([
      { name: 'name', type: 'string' },
      { name: 'on', type: 'boolean' },
    ]);
  });
});

describe('when writing a new state property', () => {
  it('should add to a non-empty object and its interface', () => {
    const src =
      'export interface State { score: number }\nexport const state: State = { score: 0 }';
    const next = applyEdits(src, addStateProperty(prog(src), 'lives', 'number'));
    expect(readStateVariables(prog(next))).toEqual([
      { name: 'score', type: 'number' },
      { name: 'lives', type: 'number' },
    ]);
  });

  it('should seed the first property of an empty object + interface', () => {
    const src = 'export interface State {}\nexport const state: State = {}';
    const next = applyEdits(src, addStateProperty(prog(src), 'score', 'number'));
    expect(readStateVariables(prog(next))).toEqual([{ name: 'score', type: 'number' }]);
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
