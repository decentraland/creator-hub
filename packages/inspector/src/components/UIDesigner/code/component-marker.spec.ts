import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';

import { componentMarkerEdit, hasComponentMarker } from './component-marker';
import { applyEdits } from './emit-adapter';

function parsed(source: string) {
  const r = parseSync('S.tsx', source);
  expect(r.errors).toHaveLength(0);
  return { program: r.program as any, comments: r.comments as any };
}

const SCREEN = `import ReactEcs from '@dcl/sdk/react-ecs'

export function OtroNombre() {
  return <UiEntity />
}
`;

const COMPONENT = `import ReactEcs from '@dcl/sdk/react-ecs'

/** @ui-component */
export function OtroNombre() {
  return <UiEntity />
}
`;

describe('hasComponentMarker', () => {
  it('detects the block-comment marker but not a string literal', () => {
    expect(hasComponentMarker(COMPONENT)).toBe(true);
    expect(hasComponentMarker(SCREEN)).toBe(false);
    // A string that merely contains the tag text must not false-match.
    expect(hasComponentMarker('const x = "@ui-component"')).toBe(false);
  });
});

describe('componentMarkerEdit', () => {
  it('adds the marker to make a screen a component', () => {
    const { program, comments } = parsed(SCREEN);
    const next = applyEdits(
      SCREEN,
      componentMarkerEdit(program, comments, SCREEN, 'OtroNombre', true),
    );
    expect(next).toContain('/** @ui-component */\nexport function OtroNombre()');
    expect(parseSync('S.tsx', next).errors).toHaveLength(0);
  });

  it('removes the marker to make a component top-level', () => {
    const { program, comments } = parsed(COMPONENT);
    const next = applyEdits(
      COMPONENT,
      componentMarkerEdit(program, comments, COMPONENT, 'OtroNombre', false),
    );
    expect(next).not.toContain('@ui-component');
    expect(next).toContain('export function OtroNombre()');
    expect(parseSync('S.tsx', next).errors).toHaveLength(0);
  });

  it('is idempotent (no edits when already in the desired state)', () => {
    const s = parsed(SCREEN);
    expect(componentMarkerEdit(s.program, s.comments, SCREEN, 'OtroNombre', false)).toEqual([]);
    const c = parsed(COMPONENT);
    expect(componentMarkerEdit(c.program, c.comments, COMPONENT, 'OtroNombre', true)).toEqual([]);
  });

  it('returns [] for an unknown component name', () => {
    const { program, comments } = parsed(SCREEN);
    expect(componentMarkerEdit(program, comments, SCREEN, 'Nope', true)).toEqual([]);
  });
});
