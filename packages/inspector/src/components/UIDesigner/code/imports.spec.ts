import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';

import { collectNamedImports, resolveModuleCandidates } from './imports';

function program(source: string) {
  const r = parseSync('S.tsx', source);
  expect(r.errors).toHaveLength(0);
  return r.program as any;
}

describe('collectNamedImports', () => {
  it('collects named specifiers with their local/imported names', () => {
    const p = program(`
      import { score, level as lvl } from './shared'
      import { theme } from '../theme'
    `);
    expect(collectNamedImports(p)).toEqual([
      {
        from: './shared',
        specifiers: [
          { imported: 'score', local: 'score' },
          { imported: 'level', local: 'lvl' },
        ],
      },
      { from: '../theme', specifiers: [{ imported: 'theme', local: 'theme' }] },
    ]);
  });

  it('skips default and namespace imports (they cannot map to one @ui-bind decl)', () => {
    const p = program(`
      import React from '@dcl/sdk/react-ecs'
      import * as All from './all'
      import { score } from './shared'
    `);
    // React (default) and All (namespace) are dropped; only the named import remains.
    expect(collectNamedImports(p)).toEqual([
      { from: './shared', specifiers: [{ imported: 'score', local: 'score' }] },
    ]);
  });

  it('returns [] when there are no imports', () => {
    expect(collectNamedImports(program('export const state = {}'))).toEqual([]);
  });
});

describe('resolveModuleCandidates', () => {
  const active = 'src/ui/MainUI.tsx';

  it('resolves a sibling specifier to .ts/.tsx/index candidates', () => {
    expect(resolveModuleCandidates(active, './shared')).toEqual([
      'src/ui/shared.ts',
      'src/ui/shared.tsx',
      'src/ui/shared/index.ts',
      'src/ui/shared/index.tsx',
    ]);
  });

  it('resolves a parent specifier by popping the active dir', () => {
    expect(resolveModuleCandidates(active, '../state')).toEqual([
      'src/state.ts',
      'src/state.tsx',
      'src/state/index.ts',
      'src/state/index.tsx',
    ]);
  });

  it('uses an explicit extension verbatim', () => {
    expect(resolveModuleCandidates(active, './shared.ts')).toEqual(['src/ui/shared.ts']);
  });

  it('returns null for a bare/package specifier', () => {
    expect(resolveModuleCandidates(active, '@dcl/sdk/react-ecs')).toBeNull();
    expect(resolveModuleCandidates(active, 'react')).toBeNull();
  });
});
