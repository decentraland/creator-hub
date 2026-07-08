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

  it('should generate a valid, parseable starter root component', () => {
    const src = generateRootComponent('MyScreen');
    const result = parseSync('MyScreen.tsx', src);
    expect(result.errors).toHaveLength(0);
    // The editor can read it back: a UiEntity root containing a Label.
    const parsed = codeToUINodes(result.program as any, src)!;
    expect(parsed.root.type).toBe('UiEntity');
    expect(parsed.root.children[0].type).toBe('Label');
    expect(parsed.root.children[0].uiText).toEqual({ value: 'MyScreen', fontSize: 32 });
  });
});
