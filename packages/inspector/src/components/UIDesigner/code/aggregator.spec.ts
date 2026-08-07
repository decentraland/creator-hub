import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';

import { DEFAULT_CANVAS_HEIGHT, DEFAULT_CANVAS_WIDTH } from '../tree-model';
import {
  generateInteractionHelper,
  generateRootComponent,
  generateUiIndex,
  readVirtualSize,
} from './aggregator';
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

  describe('and no virtual size is given', () => {
    it('should emit the editor stage size so canvas and in-world px agree', () => {
      const src = generateUiIndex([{ component: 'MyScreen', from: './MyScreen' }]);
      expect(src).toContain(
        `{ virtualWidth: ${DEFAULT_CANVAS_WIDTH}, virtualHeight: ${DEFAULT_CANVAS_HEIGHT} }`,
      );
      expect(parseSync('index.tsx', src).errors).toHaveLength(0);
    });
  });

  describe('and a virtual size is given', () => {
    it('should emit it and stay valid TSX', () => {
      const src = generateUiIndex([{ component: 'Hud', from: './Hud' }], {
        width: 1280,
        height: 720,
      });
      expect(src).toContain('{ virtualWidth: 1280, virtualHeight: 720 }');
      expect(parseSync('index.tsx', src).errors).toHaveLength(0);
    });

    it('should fall back for a non-positive or non-finite size', () => {
      const src = generateUiIndex([{ component: 'Hud', from: './Hud' }], {
        width: 0,
        height: Number.NaN,
      });
      expect(src).toContain(
        `{ virtualWidth: ${DEFAULT_CANVAS_WIDTH}, virtualHeight: ${DEFAULT_CANVAS_HEIGHT} }`,
      );
    });
  });
});

describe('when reading back the virtual size of an existing aggregator', () => {
  it('should round-trip what it generated', () => {
    const src = generateUiIndex([{ component: 'Hud', from: './Hud' }], {
      width: 1280,
      height: 720,
    });
    expect(readVirtualSize(src)).toEqual({ width: 1280, height: 720 });
  });

  it('should preserve a hand-edited size across regeneration', () => {
    const edited = generateUiIndex([{ component: 'Hud', from: './Hud' }]).replace(
      '{ virtualWidth: 1920, virtualHeight: 1080 }',
      '{ virtualWidth: 2560, virtualHeight: 1440 }',
    );
    const regenerated = generateUiIndex(
      [
        { component: 'Hud', from: './Hud' },
        { component: 'MyScreen', from: './MyScreen' },
      ],
      readVirtualSize(edited),
    );
    expect(regenerated).toContain('{ virtualWidth: 2560, virtualHeight: 1440 }');
    expect(regenerated).toContain('<MyScreen />');
  });

  it('should fall back to the stage size when the call has no options', () => {
    expect(readVirtualSize('ReactEcsRenderer.setUiRenderer(uiMenu)')).toEqual({
      width: DEFAULT_CANVAS_WIDTH,
      height: DEFAULT_CANVAS_HEIGHT,
    });
    expect(readVirtualSize('')).toEqual({
      width: DEFAULT_CANVAS_WIDTH,
      height: DEFAULT_CANVAS_HEIGHT,
    });
  });
});

describe('when generating the interaction-state helper', () => {
  const src = generateInteractionHelper();

  it('should be valid, parseable TSX', () => {
    expect(parseSync('interaction.tsx', src).errors).toHaveLength(0);
  });

  it('should read useState off the ReactEcs namespace', () => {
    // `useState` is NOT a top-level export of '@dcl/sdk/react-ecs' — it lives on
    // the ReactEcs namespace, so a bare `import { useState }` does not resolve.
    expect(src).toContain('ReactEcs.useState');
    expect(src).not.toMatch(/import \{[^}]*\buseState\b/);
  });

  it('should be generic in the base layer so required props survive', () => {
    // A Label's `value` is REQUIRED by UiLabelProps. Once it lives in the base
    // layer, only a return type shaped like that layer keeps
    // `<Label {...styles} />` typechecking in a strict scene.
    expect(src).toContain('export function useInteraction<T extends InteractionLayer');
    expect(src).toContain('): T {');
  });

  it('should apply the layers in precedence order and chain handlers', () => {
    expect(src.indexOf('layers.active')).toBeLessThan(src.indexOf('layers.hover'));
    expect(src.indexOf('layers.hover')).toBeLessThan(src.indexOf('layers.press'));
    // A handler declared in a layer must still fire after the state tracker.
    expect(src).toContain('style.onMouseDown');
    expect(src).toContain('style.onMouseUp');
  });
});
