import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';

import {
  type BoundVar,
  isValidTemplate,
  readActions,
  removeActionDecl,
  setActionBodyEdit,
  templateToBody,
} from './actions';
import { applyEdits } from './emit-adapter';

function parsed(source: string) {
  const r = parseSync('S.tsx', source);
  expect(r.errors).toHaveLength(0);
  return { program: r.program as any, comments: r.comments as any };
}

// counter/on are typed-state vars (state.x); score is a bare @ui-bind marker.
const VARS: BoundVar[] = [
  { name: 'counter', expr: 'state.counter' },
  { name: 'on', expr: 'state.on' },
  { name: 'score', expr: 'score' },
];

const SRC = `import ReactEcs from '@dcl/sdk/react-ecs'

export interface State { counter: number; on: boolean }
export const state: State = { counter: 0, on: false }
/** @ui-bind */ let score = 0

/** @ui-action */
function onIncrement(state: State) {
  state.counter += 1
  score = state.counter
  state.on = !state.on
}

/** @ui-action */
function onAdvanced(state: State) {
  for (const x of list) doThing(x)
}
`;

describe('readActions → {{ var }} template', () => {
  it('templatizes state member-exprs and bare marker references', () => {
    const { program, comments } = parsed(SRC);
    const actions = readActions(program, comments, SRC, VARS);
    expect(actions).toEqual([
      {
        name: 'onIncrement',
        template: '{{ counter }} += 1\n{{ score }} = {{ counter }}\n{{ on }} = !{{ on }}',
      },
      { name: 'onAdvanced', template: 'for (const x of list) doThing(x)' },
    ]);
  });

  it('does not templatize a member property or a non-bound identifier', () => {
    const src = '/** @ui-action */ function f(state: State) { obj.counter = list }';
    const { program, comments } = parsed(src);
    // `obj.counter` is not `state.counter`; `list` is not a bound var.
    expect(readActions(program, comments, src, VARS)[0].template).toBe('obj.counter = list');
  });
});

describe('isValidTemplate', () => {
  it('accepts well-formed placeholders and plain code', () => {
    expect(isValidTemplate('{{ counter }} += 1')).toBe(true);
    expect(isValidTemplate('{{ a }} = {{ b }}')).toBe(true);
    expect(isValidTemplate('doThing(state)')).toBe(true);
    expect(isValidTemplate('')).toBe(true);
  });

  it('rejects a malformed placeholder or stray braces', () => {
    expect(isValidTemplate("{{ none prope }} = 'alave'")).toBe(false); // space in the name
    expect(isValidTemplate('{{ counter }} += {{')).toBe(false); // unclosed
    expect(isValidTemplate('foo }} bar')).toBe(false); // stray close
    expect(isValidTemplate('{{ }}')).toBe(false); // empty
  });
});

describe('templateToBody', () => {
  it('resolves each placeholder to its variable expression', () => {
    expect(templateToBody('{{ counter }} += {{ score }}', VARS)).toBe('state.counter += score');
  });
  it('leaves an unknown placeholder as the bare name', () => {
    expect(templateToBody('{{ mystery }} = 1', VARS)).toBe('mystery = 1');
  });
});

describe('setActionBody round-trip (template → code → template)', () => {
  it('splices the body and reads back the same template', () => {
    const { program } = parsed(SRC);
    const nextTemplate = '{{ counter }} = 0\n{{ on }} = true';
    const code = templateToBody(nextTemplate, VARS);
    const next = applyEdits(SRC, setActionBodyEdit(program, 'onIncrement', code));
    expect(next).toContain('state.counter = 0');
    expect(next).toContain('state.on = true');
    const p2 = parsed(next);
    const inc = readActions(p2.program, p2.comments, next, VARS).find(
      a => a.name === 'onIncrement',
    );
    expect(inc?.template).toBe(nextTemplate);
    expect(parseSync('S.tsx', next).errors).toHaveLength(0);
  });

  it('empties a handler body to {} for a blank template', () => {
    const { program } = parsed(SRC);
    const next = applyEdits(SRC, setActionBodyEdit(program, 'onIncrement', ''));
    expect(next).toContain('function onIncrement(state: State) {}');
    expect(parseSync('S.tsx', next).errors).toHaveLength(0);
  });
});

describe('removeActionDecl', () => {
  it('removes the handler and its @ui-action comment', () => {
    const { program, comments } = parsed(SRC);
    const next = applyEdits(SRC, removeActionDecl(program, 'onIncrement', comments, SRC));
    expect(next).not.toContain('onIncrement');
    expect(next).toContain('onAdvanced');
    expect(parseSync('S.tsx', next).errors).toHaveLength(0);
  });
});
