import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';

import { collectComponentRefNames, reaches, wouldCycle } from './component-graph';

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
