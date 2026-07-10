import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';

import { extractBindingSurface } from './bindings';

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
