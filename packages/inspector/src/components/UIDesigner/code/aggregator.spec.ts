import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';

import { generateRootComponent, generateUiIndex } from './aggregator';
import { codeToUINodes } from './parse-adapter';

describe('when generating the file-per-root aggregator', () => {
  it('should import and compose every root and parse without errors', () => {
    const src = generateUiIndex([
      { component: 'MyScreen', from: './MyScreen' },
      { component: 'Hud', from: './Hud' },
    ]);
    expect(src).toContain("import { MyScreen } from './MyScreen'");
    expect(src).toContain("import { Hud } from './Hud'");
    expect(src).toContain('<MyScreen />');
    expect(src).toContain('<Hud />');
    expect(src).toContain('ReactEcsRenderer.setUiRenderer');
    // It's valid TSX.
    expect(parseSync('index.tsx', src).errors).toHaveLength(0);
  });

  it('should drop a root whose component name is not a valid identifier', () => {
    const src = generateUiIndex([
      { component: 'MyScreen', from: './MyScreen' },
      // A crafted basename that would splice code into the import/JSX if emitted.
      { component: "A } from 'x';someCall();//", from: './evil' },
    ]);
    expect(src).toContain("import { MyScreen } from './MyScreen'");
    expect(src).toContain('<MyScreen />');
    expect(src).not.toContain('someCall');
    expect(src).not.toContain("from './evil'");
    // The dropped root doesn't break the emit: the output is still valid TSX.
    expect(parseSync('index.tsx', src).errors).toHaveLength(0);
  });

  it('should generate a valid, parseable EMPTY starter component', () => {
    const src = generateRootComponent('MyScreen');
    const result = parseSync('MyScreen.tsx', src);
    expect(result.errors).toHaveLength(0);
    expect(src).toContain('export function MyScreen(props: {})');
    // Starts empty: no elements yet, so there's no canvas tree. The store treats
    // this as a valid empty GUI (emptyRoot) and shows the "drop your first
    // element" canvas; the first widget added splices `return (<…/>)`.
    expect(codeToUINodes(result.program as any, src)).toBeNull();
    // The State scaffold is present so the State/Logic panel has an anchor.
    expect(src).toContain('export const state: State = {}');
  });
});
