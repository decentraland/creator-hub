import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';

import {
  generateInteractionHelper,
  generateRootComponent,
  generateUiIndex,
  readRootInsets,
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

  it('should not emit a design resolution — react-ecs defaults it per device', () => {
    const src = generateUiIndex([{ component: 'MyScreen', from: './MyScreen' }]);
    expect(src).not.toContain('virtualWidth');
    expect(src).not.toContain('virtualHeight');
    expect(parseSync('index.tsx', src).errors).toHaveLength(0);
  });
});

describe('when placing roots in screen inset areas', () => {
  it('should default an unspecified root to the device safe area wrapper', () => {
    const src = generateUiIndex([{ component: 'MyScreen', from: './MyScreen' }]);
    expect(src).toContain('<ScreenInsetArea>');
    expect(src).toContain('<MyScreen />');
    expect(src).toContain('import ReactEcs, { UiEntity, ReactEcsRenderer, ScreenInsetArea }');
    expect(parseSync('index.tsx', src).errors).toHaveLength(0);
  });

  it('should wrap each root in the container for its inset and import only those used', () => {
    const src = generateUiIndex([
      { component: 'Safe', from: './Safe', screenInset: 'device' },
      { component: 'Hud', from: './Hud', screenInset: 'interactable' },
      { component: 'Full', from: './Full', screenInset: 'none' },
    ]);
    expect(src).toMatch(/<ScreenInsetArea>\s*<Safe \/>\s*<\/ScreenInsetArea>/);
    expect(src).toMatch(/<InteractableArea>\s*<Hud \/>\s*<\/InteractableArea>/);
    expect(src).toMatch(/<Full \/>/);
    expect(src).not.toMatch(/<\w+Area>\s*<Full/);
    expect(src).toContain(
      'import ReactEcs, { UiEntity, ReactEcsRenderer, ScreenInsetArea, InteractableArea }',
    );
    expect(parseSync('index.tsx', src).errors).toHaveLength(0);
  });

  it('should not import an inset container when no root uses it', () => {
    const src = generateUiIndex([{ component: 'Full', from: './Full', screenInset: 'none' }]);
    expect(src).toContain(
      "import ReactEcs, { UiEntity, ReactEcsRenderer } from '@dcl/sdk/react-ecs'",
    );
    expect(src).not.toContain('ScreenInsetArea');
    expect(src).not.toContain('InteractableArea');
  });
});

describe('when reading back root insets from an existing aggregator', () => {
  it('should round-trip every inset it generated', () => {
    const src = generateUiIndex([
      { component: 'Safe', from: './Safe', screenInset: 'device' },
      { component: 'Hud', from: './Hud', screenInset: 'interactable' },
      { component: 'Full', from: './Full', screenInset: 'none' },
    ]);
    expect(readRootInsets(src)).toEqual({ Safe: 'device', Hud: 'interactable', Full: 'none' });
  });

  it('should preserve per-root insets across regeneration', () => {
    const first = generateUiIndex([
      { component: 'Hud', from: './Hud', screenInset: 'interactable' },
    ]);
    const insets = readRootInsets(first);
    const regenerated = generateUiIndex([
      { component: 'Hud', from: './Hud', screenInset: insets.Hud },
      { component: 'MyScreen', from: './MyScreen' },
    ]);
    expect(regenerated).toMatch(/<InteractableArea>\s*<Hud \/>\s*<\/InteractableArea>/);
    expect(regenerated).toContain('<MyScreen />');
  });

  it('should omit bare roots from a pre-inset aggregator so they fall back to the default', () => {
    expect(readRootInsets('<MyScreen />\n<Hud />')).toEqual({});
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
