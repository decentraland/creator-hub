import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';

import {
  type BoundVar,
  isValidTemplate,
  migrateActionsToArgsObject,
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

describe('props in {{ }} templates (args-object handlers)', () => {
  const PROP_VARS: BoundVar[] = [
    { name: 'counter', expr: 'state.counter' },
    { name: 'nombre', expr: 'props.nombre' },
  ];

  it('templatizes props.<name> as a qualified {{ props.<name> }}', () => {
    const src =
      '/** @ui-action */ function f({ state, props }: UiAction) { state.counter = props.nombre }';
    const { program, comments } = parsed(src);
    expect(readActions(program, comments, src, PROP_VARS)[0].template).toBe(
      '{{ counter }} = {{ props.nombre }}',
    );
  });

  it('resolves {{ props.x }} to props.x; a bare name never resolves to props', () => {
    expect(templateToBody('{{ counter }} = {{ props.nombre }}', PROP_VARS)).toBe(
      'state.counter = props.nombre',
    );
    // props are always QUALIFIED — a bare name matching a prop stays bare.
    expect(templateToBody('{{ nombre }}', PROP_VARS)).toBe('nombre');
  });

  it('accepts a qualified props placeholder as valid', () => {
    expect(isValidTemplate('{{ props.nombre }} + {{ counter }}')).toBe(true);
  });
});

describe('migrateActionsToArgsObject', () => {
  const OLD = `import ReactEcs, { Button } from '@dcl/sdk/react-ecs'

export interface State {}
export const state: State = {}

/** @ui-action */
function onClick(state: State, value?: unknown) {}

export function Card(props: { n: number }) {
  return <Button onMouseDown={() => onClick(state)} />
}
`;

  it('rewrites old-form handlers + thunks and seeds the UiAction type', () => {
    const { program, comments } = parsed(OLD);
    const next = applyEdits(OLD, migrateActionsToArgsObject(program, comments, OLD, 'Card'));
    expect(next).toContain('function onClick({ state, props, value }: UiAction)');
    expect(next).toContain('onMouseDown={() => onClick({ state, props })}');
    expect(next).toContain(
      'type UiAction = { state: State; props: Parameters<typeof Card>[0]; value?: unknown }',
    );
    expect(parseSync('S.tsx', next).errors).toHaveLength(0);
  });

  it('is idempotent — migrating already-migrated source is a no-op', () => {
    const { program, comments } = parsed(OLD);
    const migrated = applyEdits(OLD, migrateActionsToArgsObject(program, comments, OLD, 'Card'));
    const p2 = parsed(migrated);
    expect(migrateActionsToArgsObject(p2.program, p2.comments, migrated, 'Card')).toEqual([]);
  });

  it('adds a props param when the component has none', () => {
    const noProps = `import ReactEcs from '@dcl/sdk/react-ecs'

export interface State {}
export const state: State = {}

/** @ui-action */
function onClick(state: State) {}

export function Card() {
  return
}
`;
    const { program, comments } = parsed(noProps);
    const next = applyEdits(
      noProps,
      migrateActionsToArgsObject(program, comments, noProps, 'Card'),
    );
    expect(next).toContain('export function Card(props: {})');
    expect(next).toContain('function onClick({ state, props, value }: UiAction)');
    expect(parseSync('S.tsx', next).errors).toHaveLength(0);
  });

  it('leaves a file with no old-form handlers untouched', () => {
    const clean = `export interface State {}
export const state: State = {}
export function Card(props: {}) { return }
`;
    const { program, comments } = parsed(clean);
    expect(migrateActionsToArgsObject(program, comments, clean, 'Card')).toEqual([]);
  });
});
