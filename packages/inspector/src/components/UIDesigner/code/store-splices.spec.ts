import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';

import { YGPT_ABSOLUTE } from '../../../lib/sdk/ui-transform-constants';
import { applyEdits, insertChild } from './emit-adapter';
import { codeToUINodes } from './parse-adapter';
import { parentIsFree, widgetJsx } from './store-splices';

const transformOf = (jsx: string): Record<string, unknown> => {
  const source = `export function S() {\n  return ${jsx}\n}`;
  const r = parseSync('S.tsx', source);
  expect(r.errors).toHaveLength(0);
  const parsed = codeToUINodes(r.program as any, source)!;
  expect(parsed).not.toBeNull();
  return (parsed.root.uiTransform as Record<string, unknown>) ?? {};
};

const isAbsolute = (t: Record<string, unknown>): boolean => t.positionType === YGPT_ABSOLUTE;

describe('widgetJsx fullscreen preset', () => {
  it('emits a fill x fill container: flexGrow + stretch, no width/height', () => {
    const jsx = widgetJsx('UiEntity', 'fullscreen', false);

    expect(jsx).toContain('flexGrow: 1');
    expect(jsx).toContain("alignSelf: 'stretch'");
    expect(jsx).not.toMatch(/\bwidth:/);
    expect(jsx).not.toMatch(/\bheight:/);
  });

  it('leaves the plain container fixed-size', () => {
    const jsx = widgetJsx('UiEntity', undefined, false);

    expect(jsx).toContain('width: 200');
    expect(jsx).toContain('height: 100');
  });
});

describe('widgetJsx free seed', () => {
  it('pins a free node at top-left by default', () => {
    const jsx = widgetJsx('UiEntity', undefined, false, true);

    expect(jsx).toContain("positionType: 'absolute'");
    expect(jsx).toContain('position: { top: 0, left: 0 }');
    expect(isAbsolute(transformOf(jsx))).toBe(true);
  });

  it('pins a free node at the drop point when given one', () => {
    const jsx = widgetJsx('UiEntity', undefined, false, true, { top: 80, left: 120 });

    expect(jsx).toContain('position: { top: 80, left: 120 }');
    expect(isAbsolute(transformOf(jsx))).toBe(true);
  });

  it('rounds a fractional drop point so generated source stays integer', () => {
    const jsx = widgetJsx('UiEntity', undefined, false, true, { top: 80.6, left: 119.4 });

    expect(jsx).toContain('position: { top: 81, left: 119 }');
  });

  it('leaves an in-flow node relative (no positionType)', () => {
    const jsx = widgetJsx('UiEntity', undefined, false, false);

    expect(jsx).not.toContain('positionType');
    expect(isAbsolute(transformOf(jsx))).toBe(false);
  });

  it('makes the fullscreen preset free via absolute inset-0, not flexGrow', () => {
    const jsx = widgetJsx('UiEntity', 'fullscreen', false, true);

    expect(jsx).toContain("positionType: 'absolute'");
    expect(jsx).toContain('position: { top: 0, right: 0, bottom: 0, left: 0 }');
    expect(jsx).not.toContain('flexGrow');
    expect(isAbsolute(transformOf(jsx))).toBe(true);
  });
});

describe('parentIsFree', () => {
  it('is free when the parent has no flexDirection (children placed absolutely)', () => {
    expect(parentIsFree({ uiTransform: {} })).toBe(true);
    expect(parentIsFree({ uiTransform: { width: 400 } })).toBe(true);
    expect(parentIsFree({})).toBe(true);
    expect(parentIsFree(null)).toBe(true);
  });

  it('is not free (in flow) once the parent has a flexDirection', () => {
    expect(parentIsFree({ uiTransform: { flexDirection: 0 } })).toBe(false);
    expect(parentIsFree({ uiTransform: { flexDirection: 1 } })).toBe(false);
  });
});

describe('the add-child emit (widgetJsx(free) → insertChild → reparse)', () => {
  const parseRoot = (source: string) => {
    const r = parseSync('S.tsx', source);
    expect(r.errors).toHaveLength(0);
    const parsed = codeToUINodes(r.program as any, source)!;
    expect(parsed).not.toBeNull();
    return parsed;
  };

  const dropChildInto = (parentSource: string, free: boolean): Record<string, unknown> => {
    const parsed = parseRoot(parentSource);
    const ast = parsed.astNodes.get(parsed.root.entity as unknown as number) as any;
    const jsx = widgetJsx('UiEntity', undefined, false, free);
    const next = applyEdits(parentSource, insertChild(ast, parentSource, jsx));
    const child = parseRoot(next).root.children[0];
    return (child.uiTransform as Record<string, unknown>) ?? {};
  };

  const PARENT = `export function S() {
  return <UiEntity uiTransform={{ width: 400, height: 200 }} />
}`;

  it('a free child parses back as absolute', () => {
    expect(isAbsolute(dropChildInto(PARENT, true))).toBe(true);
  });

  it('an in-flow child parses back as relative', () => {
    expect(isAbsolute(dropChildInto(PARENT, false))).toBe(false);
  });
});
