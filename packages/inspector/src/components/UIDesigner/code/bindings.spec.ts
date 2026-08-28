import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';

import { extractBindingSurface, isActionNameTaken } from './bindings';

function surfaceOf(source: string) {
  const r = parseSync('s.tsx', source);
  return extractBindingSurface(r.program as any, r.comments as any, source);
}

describe('when extracting the @ui-bind / @ui-action surface', () => {
  it('should collect annotated variables with their types and annotated functions', () => {
    const source = `/** @ui-bind */
let score: number = 0

/** @ui-bind */
let title = 'hello'

/** @ui-bind */
export let enabled = true

/** @ui-action */
function onStart() {}

/** @ui-action */
export function onStop() {}

export function S() { return <UiEntity /> }`;
    const surface = surfaceOf(source);
    expect(surface.variables).toEqual([
      { name: 'score', type: 'number', expr: 'score' }, // explicit annotation
      { name: 'title', type: 'string', expr: 'title' }, // inferred from string literal
      { name: 'enabled', type: 'boolean', expr: 'enabled' }, // inferred from boolean literal
    ]);
    expect(surface.actions).toEqual([{ name: 'onStart' }, { name: 'onStop' }]);
  });

  it('should ignore declarations without a marker comment', () => {
    const source = `let notBound = 1
function notAction() {}
/** just a comment */
let alsoNot = 2`;
    const surface = surfaceOf(source);
    expect(surface.variables).toHaveLength(0);
    expect(surface.actions).toHaveLength(0);
  });

  it('should not attach a marker across an intervening declaration', () => {
    // The @ui-bind marker precedes `a`, not `b`.
    const source = `/** @ui-bind */
let a = 1
let b = 2`;
    const surface = surfaceOf(source);
    expect(surface.variables).toEqual([{ name: 'a', type: 'number', expr: 'a' }]);
  });
});

// Adding an action splices a top-level `function <name>({ state, props, value }:
// UiAction) {}`, so a name taken by anything else in that scope is a scene that
// stops compiling — with nothing in the editor to say why. The editor's only
// signal is this predicate.
describe('when naming a new @ui-action', () => {
  const surface = {
    variables: [
      { name: 'score', type: 'number', expr: 'state.score' },
      { name: 'label', type: 'string', expr: 'props.label' },
      { name: 'lives', type: 'number', expr: 'lives' },
    ],
    actions: [{ name: 'onStart' }],
  };

  it('should reject a name held by another action, a variable or a prop', () => {
    for (const name of ['onStart', 'score', 'label', 'lives']) {
      expect(isActionNameTaken(surface, name), name).toBe(true);
    }
  });

  it('should reject the names the generated signature itself occupies', () => {
    for (const name of ['state', 'props', 'value', 'UiAction']) {
      expect(isActionNameTaken(surface, name), name).toBe(true);
    }
  });

  it('should accept a free name', () => {
    expect(isActionNameTaken(surface, 'onStop')).toBe(false);
  });
});
