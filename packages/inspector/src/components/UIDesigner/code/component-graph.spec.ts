import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';

import {
  collectComponentRefNames,
  reaches,
  referencesRoot,
  renameComponentRefEdits,
  wouldCycle,
} from './component-graph';
import { applyEdits } from './emit-adapter';

function program(source: string) {
  const r = parseSync('S.tsx', source);
  expect(r.errors).toHaveLength(0);
  return r.program as any;
}

describe('collectComponentRefNames', () => {
  it('collects known-component JSX names, ignoring primitives and unknowns', () => {
    const p = program(`
      export function MainUI() {
        return (
          <UiEntity>
            <OtroNombre />
            <Sidebar />
            <Label value="x" />
            <Foreign />
          </UiEntity>
        )
      }
    `);
    const known = new Set(['OtroNombre', 'Sidebar', 'MainUI']);
    expect(collectComponentRefNames(p, known).sort()).toEqual(['OtroNombre', 'Sidebar']);
  });
});

describe('reaches / wouldCycle', () => {
  // A → B → C ; D isolated.
  const refs = new Map<string, string[]>([
    ['A', ['B']],
    ['B', ['C']],
    ['C', []],
    ['D', []],
  ]);

  it('follows edges transitively', () => {
    expect(reaches(refs, 'A', 'C')).toBe(true);
    expect(reaches(refs, 'C', 'A')).toBe(false);
    expect(reaches(refs, 'A', 'A')).toBe(true); // self counts
    expect(reaches(refs, 'A', 'D')).toBe(false);
  });

  it('flags a nest that would close a cycle', () => {
    // Nesting A inside C adds C→A; A reaches C, so it cycles.
    expect(wouldCycle(refs, 'C', 'A')).toBe(true);
    // Nesting D inside A adds A→D; D reaches nothing, so it's safe.
    expect(wouldCycle(refs, 'A', 'D')).toBe(false);
    // Direct self-nest is a cycle.
    expect(wouldCycle(refs, 'A', 'A')).toBe(true);
  });
});

describe('referencesRoot', () => {
  it('detects an import of the root (even without a JSX usage)', () => {
    const p = program("import { Card } from './Card'\nexport function A() { return <UiEntity /> }");
    expect(referencesRoot(p, 'Card')).toBe(true);
  });

  it('detects a JSX usage', () => {
    const p = program('export function A() { return <UiEntity><Card /></UiEntity> }');
    expect(referencesRoot(p, 'Card')).toBe(true);
  });

  it('does not flag unrelated files', () => {
    const p = program(
      "import { Other } from './Other'\nexport function A() { return <UiEntity /> }",
    );
    expect(referencesRoot(p, 'Card')).toBe(false);
  });
});

describe('renameComponentRefEdits', () => {
  it('rewrites the import source, specifier, and JSX tags for a shorthand import', () => {
    const src = `import { Card } from './Card'
export function A() {
  return (
    <UiEntity>
      <Card title="Hi">
        <UiEntity />
      </Card>
    </UiEntity>
  )
}`;
    const next = applyEdits(src, renameComponentRefEdits(program(src), 'Card', 'Panel'));
    expect(next).toContain("import { Panel } from './Panel'");
    expect(next).toContain('<Panel title="Hi">');
    expect(next).toContain('</Panel>');
    expect(next).not.toContain('Card');
    expect(parseSync('S.tsx', next).errors).toHaveLength(0);
  });

  it('keeps the alias (and its JSX) for an aliased import, rewriting only source + imported name', () => {
    const src = `import { Card as C } from './Card'
export function A() { return <C /> }`;
    const next = applyEdits(src, renameComponentRefEdits(program(src), 'Card', 'Panel'));
    expect(next).toContain("import { Panel as C } from './Panel'");
    expect(next).toContain('<C />');
    expect(parseSync('S.tsx', next).errors).toHaveLength(0);
  });

  it('preserves a directory prefix and extension in the module specifier', () => {
    const src = `import { Card } from '../ui/Card.tsx'
export function A() { return <Card /> }`;
    const next = applyEdits(src, renameComponentRefEdits(program(src), 'Card', 'Panel'));
    expect(next).toContain("from '../ui/Panel.tsx'");
  });

  it('does not touch a same-named import from a DIFFERENT module', () => {
    const src = `import { Card } from 'some-library'
export function A() { return <Card /> }`;
    expect(renameComponentRefEdits(program(src), 'Card', 'Panel')).toHaveLength(0);
  });

  it('does not rename attribute names or string literals', () => {
    const src = `import { Card } from './Card'
export function A() { return <Card Card="Card" /> }`;
    const next = applyEdits(src, renameComponentRefEdits(program(src), 'Card', 'Panel'));
    expect(next).toContain('<Panel Card="Card" />');
  });
});
