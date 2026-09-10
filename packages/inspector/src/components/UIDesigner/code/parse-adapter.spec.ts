import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';

import { YGU_POINT } from '../../../lib/sdk/ui-transform-constants';
import type { UINodeType } from '../shared/tree-model';
import { applyEdits } from './emit-adapter';
import { wrapInInteractionEdits } from './interaction-convention';
import {
  codeToUINodes,
  findComponentFn,
  findComponentIdSpan,
  isLayerableProp,
} from './parse-adapter';
import type { CodeUINode } from './types';

function parse(source: string) {
  const result = parseSync('MyScreen.tsx', source);
  expect(result.errors).toHaveLength(0);
  return codeToUINodes(result.program as any, source);
}

// Run the REAL "Add interaction states" splice — the store's own isLayerableProp
// and wrap builder — so these tests exercise the production path end to end
// rather than a hand-authored approximation of its output.
function addInteractionStates(source: string, type: UINodeType) {
  const program = parseSync('MyScreen.tsx', source).program as any;
  const fn = findComponentFn(program) as any;
  const ret = (fn?.body?.body ?? []).find((s: any) => s.type === 'ReturnStatement');
  let el = ret?.argument;
  while (el?.type === 'ParenthesizedExpression') el = el.expression;
  return applyEdits(
    source,
    wrapInInteractionEdits({
      program,
      fnNode: fn,
      el,
      source,
      name: 'widgetStyles',
      importFrom: './interaction',
      isLayerable: attr => isLayerableProp(type, attr),
    }),
  );
}

describe('when mapping parsed TSX to UI nodes', () => {
  describe('and the component returns a UiEntity tree with a Label and a loop', () => {
    const source = `/** @jsx ReactEcs.createElement */
import ReactEcs, { UiEntity, Label } from '@dcl/sdk/react-ecs'

export function MyScreen() {
  return (
    <UiEntity uiTransform={{ width: 400, height: 200 }} uiBackground={{ color: 'black' }}>
      <Label value="Hello" fontSize={24} />
      {items.map(i => <UiEntity key={i} />)}
    </UiEntity>
  )
}
`;

    it('should map the root UiEntity with statically-evaluated object props', () => {
      const parsed = parse(source);
      expect(parsed).not.toBeNull();
      const root = parsed!.root;
      expect(root.type).toBe('UiEntity');
      // uiTransform is normalized to the flattened PBUiTransform shape.
      expect(root.uiTransform).toEqual({
        width: 400,
        widthUnit: YGU_POINT,
        height: 200,
        heightUnit: YGU_POINT,
      });
      expect(root.uiBackground).toEqual({ color: 'black' });
      expect(root.opaque).toBeUndefined();
    });

    it('should fold Label text props into uiText', () => {
      const root = parse(source)!.root;
      const label = root.children.find(c => c.type === 'Label') as CodeUINode;
      expect(label).toBeDefined();
      expect(label.uiText).toEqual({ value: 'Hello', fontSize: 24 });
    });

    it('should record a variable-bound text prop as a binding row (not opaque)', () => {
      const src = `/** @jsx ReactEcs.createElement */
import ReactEcs, { UiEntity, Label } from '@dcl/sdk/react-ecs'
export const state = { score: 0 }
export function MyScreen() {
  return <UiEntity><Label value={state.score} /></UiEntity>
}
`;
      const label = parse(src)!.root.children.find(c => c.type === 'Label') as CodeUINode;
      expect(label.dynamicProps).toBeUndefined();
      expect(label.bindings).toEqual([{ field: 'core::UiText.value', variable: 'state.score' }]);
    });

    it('should read through a `?? default` coalesce to the clean binding expression', () => {
      const src = `/** @jsx ReactEcs.createElement */
import ReactEcs, { UiEntity, Label } from '@dcl/sdk/react-ecs'
export function MyScreen(props: { name?: string }) {
  return <UiEntity><Label value={props.name ?? ''} /></UiEntity>
}
`;
      const label = parse(src)!.root.children.find(c => c.type === 'Label') as CodeUINode;
      expect(label.dynamicProps).toBeUndefined();
      expect(label.bindings).toEqual([{ field: 'core::UiText.value', variable: 'props.name' }]);
    });

    it('should record an interpolated template value as mixed-content segments', () => {
      const src = `/** @jsx ReactEcs.createElement */
import ReactEcs, { UiEntity, Label } from '@dcl/sdk/react-ecs'
export const state = { name: '' }
export function MyScreen() {
  return <UiEntity><Label value={\`Hi \${state.name}!\`} /></UiEntity>
}
`;
      const label = parse(src)!.root.children.find(c => c.type === 'Label') as CodeUINode;
      expect(label.bindings).toEqual([
        {
          field: 'core::UiText.value',
          variable: '',
          segments: [
            { kind: 'literal', value: 'Hi ' },
            { kind: 'binding', value: 'state.name' },
            { kind: 'literal', value: '!' },
          ],
        },
      ]);
    });

    it('should record an event-handler binding under the event field key', () => {
      const src = `/** @jsx ReactEcs.createElement */
import ReactEcs, { UiEntity } from '@dcl/sdk/react-ecs'
/** @ui-action */ function onClick() {}
export function MyScreen() {
  return <UiEntity onMouseDown={onClick} />
}
`;
      const root = parse(src)!.root;
      expect(root.dynamicProps).toBeUndefined();
      expect(root.bindings).toEqual([{ field: 'ui::events.onMouseDown', variable: 'onClick' }]);
    });

    it('should extract the handler name from a thunk event binding', () => {
      const src = `/** @jsx ReactEcs.createElement */
import ReactEcs, { UiEntity } from '@dcl/sdk/react-ecs'
export const state = { counter: 0 }
/** @ui-action */ function onClick(state) { state.counter += 1 }
export function MyScreen() {
  return <UiEntity onMouseDown={() => onClick(state)} />
}
`;
      const root = parse(src)!.root;
      expect(root.dynamicProps).toBeUndefined();
      expect(root.bindings).toEqual([{ field: 'ui::events.onMouseDown', variable: 'onClick' }]);
    });

    it('should normalize Label textAlign / font strings to PB numeric enums', () => {
      const src = `/** @jsx ReactEcs.createElement */
import ReactEcs, { UiEntity, Label } from '@dcl/sdk/react-ecs'
export function MyScreen() {
  return <UiEntity><Label value="Hi" textAlign="middle-center" font="serif" /></UiEntity>
}
`;
      const label = parse(src)!.root.children.find(c => c.type === 'Label') as CodeUINode;
      // TextAlignMode.TAM_MIDDLE_CENTER = 4, Font.F_SERIF = 1.
      expect(label.uiText).toMatchObject({ value: 'Hi', textAlign: 4, font: 1 });
    });

    it('should represent the .map loop as an opaque node preserving its source', () => {
      const parsed = parse(source)!;
      expect(parsed.hasOpaque).toBe(true);
      const opaque = parsed.root.children.find(c => c.opaque) as CodeUINode;
      expect(opaque.opaque!.reason).toBe('loop');
      expect(opaque.opaque!.raw).toContain('items.map');
    });

    it('should record a source span for every node, matching the source text', () => {
      const parsed = parse(source)!;
      const root = parsed.root;
      expect(parsed.spans.get(root.entity as unknown as number)).toEqual(root.span);
      expect(source.slice(root.span[0], root.span[1]).startsWith('<UiEntity')).toBe(true);
    });
  });

  describe('and the tree contains a custom component', () => {
    const source = `export function S() {
  return (
    <UiEntity>
      <MyWidget foo={1} />
    </UiEntity>
  )
}`;

    it('should mark the custom component opaque', () => {
      const root = parse(source)!.root;
      const child = root.children[0];
      expect(child.opaque?.reason).toBe('custom-component');
      expect(child.name).toBe('MyWidget');
    });
  });

  describe('and an element uses spread props', () => {
    const source = `export function S() {
  return <UiEntity {...rest} uiTransform={{ width: 1 }} />
}`;

    it('should mark the spread element opaque', () => {
      const root = parse(source)!.root;
      expect(root.opaque?.reason).toBe('spread-props');
    });
  });

  describe('and an element spreads a recognized interaction call', () => {
    const source = `export function S() {
  const btn = useInteraction(
    {
      base: { uiTransform: { width: 100 }, uiBackground: { color: { r: 1, g: 1, b: 1, a: 1 } } },
      hover: { uiBackground: { color: { r: 0, g: 0, b: 1, a: 1 } } },
    },
    state.selected,
  )
  return <UiEntity {...btn} />
}`;

    it('should keep the node first-class rather than opaque', () => {
      const root = parse(source)!.root;
      expect(root.opaque).toBeUndefined();
      expect(root.dynamicProps).toBeUndefined();
    });

    it('should hydrate the node styles from the base layer', () => {
      const root = parse(source)!.root;
      expect(root.uiTransform).toEqual({ width: 100, widthUnit: YGU_POINT });
      expect(root.uiBackground).toMatchObject({ color: { r: 1, g: 1, b: 1, a: 1 } });
    });

    it('should expose each layer and the active expression', () => {
      const root = parse(source)!.root;
      expect(Object.keys(root.interaction!.states)).toEqual(['base', 'hover']);
      expect(root.interaction!.states.hover?.uiBackground).toMatchObject({
        color: { r: 0, g: 0, b: 1, a: 1 },
      });
      expect(root.interaction!.activeExpr).toBe('state.selected');
      expect(root.interaction!.name).toBe('btn');
    });

    it('should surface an event handler in the base layer as a binding', () => {
      const root = parse(`export function S() {
  const btn = useInteraction({ base: { onMouseDown: () => onClick({ state, props }) } })
  return <UiEntity {...btn} />
}`)!.root;
      expect(root.bindings).toEqual([{ field: 'ui::events.onMouseDown', variable: 'onClick' }]);
    });

    // Regression: "Add interaction states" sweeps a Label/Button's `value` into
    // the base layer. A BOUND value is not statically evaluable, so the layer
    // reader used to drop it and flag the layer dynamic — the canvas resolves
    // text through previewBoundText(bindings, …) with uiText as the fallback, so
    // with neither present it rendered empty, and dynamicProps silently froze
    // every subsequent panel edit. The JSX-attribute path always handled this.
    it('should surface a bound text value in the base layer as a binding', () => {
      const root = parse(`export function S() {
  const buttonStyles = useInteraction({ base: { value: state.label } })
  return <Button {...buttonStyles} />
}`)!.root;
      expect(root.bindings).toEqual([{ field: 'core::UiText.value', variable: 'state.label' }]);
      expect(root.dynamicProps).toBeUndefined();
    });

    it('should surface an interpolated text template in the base layer as segments', () => {
      const root = parse(`export function S() {
  const buttonStyles = useInteraction({ base: { value: \`Hi \${state.name}!\` } })
  return <Button {...buttonStyles} />
}`)!.root;
      expect(root.bindings).toEqual([
        {
          field: 'core::UiText.value',
          variable: '',
          segments: [
            { kind: 'literal', value: 'Hi ' },
            { kind: 'binding', value: 'state.name' },
            { kind: 'literal', value: '!' },
          ],
        },
      ]);
      expect(root.dynamicProps).toBeUndefined();
    });

    it('should hydrate a literal text value from the base layer', () => {
      const root = parse(`export function S() {
  const buttonStyles = useInteraction({ base: { value: 'Hello' } })
  return <Button {...buttonStyles} />
}`)!.root;
      expect(root.uiText).toMatchObject({ value: 'Hello' });
      expect(root.dynamicProps).toBeUndefined();
    });

    // End-to-end through the real splice: these are the shapes the palette
    // actually creates, wrapped by the real wrapInInteractionEdits +
    // isLayerableProp. The hand-authored cases above pin the reader; these pin
    // the reader AGAINST the writer, which is where "the text vanished after
    // adding states" would actually surface.
    describe('and the states are added by the real splice', () => {
      const BUTTON = `export function S() {
  return <Button value="Button" fontSize={18} uiTransform={{ width: 160, height: 44 }} />
}`;

      it('should keep a literal text value from the palette template', () => {
        const next = addInteractionStates(BUTTON, 'Button');
        expect(parseSync('MyScreen.tsx', next).errors).toHaveLength(0);
        const root = parse(next)!.root;
        expect(root.uiText).toMatchObject({ value: 'Button', fontSize: 18 });
        expect(root.dynamicProps).toBeUndefined();
      });

      it('should keep a bound text value as a binding', () => {
        const next = addInteractionStates(
          `export function S() {
  return <Button value={state.label} fontSize={18} />
}`,
          'Button',
        );
        expect(parseSync('MyScreen.tsx', next).errors).toHaveLength(0);
        const root = parse(next)!.root;
        expect(root.bindings).toEqual([{ field: 'core::UiText.value', variable: 'state.label' }]);
        expect(root.dynamicProps).toBeUndefined();
      });

      it('should keep a Label value and leave a Button variant on the element', () => {
        const label = parse(
          addInteractionStates(
            `export function S() {
  return <Label value="Hi" />
}`,
            'Label',
          ),
        )!.root;
        expect(label.uiText).toMatchObject({ value: 'Hi' });

        // `variant` is not in UI_TEXT_PROPS, so it is not layerable and must stay
        // an attribute — the spread goes in first, so a leftover attribute still
        // overrides the layer.
        const withVariant = addInteractionStates(
          `export function S() {
  return <Button value="Go" variant="secondary" />
}`,
          'Button',
        );
        expect(withVariant).toMatch(/<Button[\s\S]*variant="secondary"/);
        expect(parse(withVariant)!.root.uiText).toMatchObject({ value: 'Go' });
      });
    });

    it('should let a co-authored attribute override the base layer', () => {
      const root = parse(`export function S() {
  const btn = useInteraction({ base: { uiTransform: { width: 100 } } })
  return <UiEntity {...btn} uiTransform={{ width: 250 }} />
}`)!.root;
      expect(root.uiTransform).toMatchObject({ width: 250 });
    });

    it('should read a layer style key bound to a reference as a binding, not as dynamic', () => {
      const root = parse(`export function S() {
  const btn = useInteraction({ hover: { uiBackground: { color: theme.accent } } })
  return <UiEntity {...btn} />
}`)!.root;
      expect(root.dynamicProps).toBeUndefined();
    });

    it('should flag dynamicProps when a layer value is not statically evaluable', () => {
      const root = parse(`export function S() {
  const btn = useInteraction({ hover: { uiBackground: { color: pick(theme) } } })
  return <UiEntity {...btn} />
}`)!.root;
      expect(root.dynamicProps).toBe(true);
      expect(root.opaque).toBeUndefined();
    });

    it('should stay opaque when the spread is not an interaction call', () => {
      const root = parse(`export function S() {
  const btn = buildStyles()
  return <UiEntity {...btn} />
}`)!.root;
      expect(root.opaque?.reason).toBe('spread-props');
    });

    // Regression: the store parses WITHOUT a componentName, so the spread is
    // resolved against whichever function findComponentFn picks. It used to
    // return the first function declaration outright — so a `@ui-action` handler
    // (which addBindAction inserts right after the imports, i.e. BEFORE the
    // component) was searched instead, the `const … = useInteraction(…)` was
    // never found, and the node collapsed to opaque. An opaque node renders no
    // children, so its whole subtree vanished from the canvas.
    it('should resolve the interaction when a non-JSX function precedes the component', () => {
      const root = parse(`/** @jsx ReactEcs.createElement */
import ReactEcs, { UiEntity } from '@dcl/sdk/react-ecs'
import { useInteraction } from './interaction'

export interface State {}
export const state: State = {}

/** @ui-action */
function onClick({ state, props }: UiAction) {}

export function MainUI(props: {}) {
  const entityStyles = useInteraction({ base: { uiTransform: { width: 200 } } })
  return (
    <UiEntity {...entityStyles}>
      <Label value="inside" />
    </UiEntity>
  )
}`)!.root;
      expect(root.opaque).toBeUndefined();
      expect(root.interaction?.states.base?.uiTransform).toMatchObject({ width: 200 });
      // The subtree survives — an opaque root would have dropped it entirely.
      expect(root.children).toHaveLength(1);
    });
  });

  describe('and the component uses a platform conditional', () => {
    it('should model a conditional child as a variant with two editable branches', () => {
      const root = parse(`/** @jsx ReactEcs.createElement */
import ReactEcs, { UiEntity, Label } from '@dcl/sdk/react-ecs'
import { usePlatform } from './platform'

export function MyScreen() {
  const platform = usePlatform()
  return (
    <UiEntity uiTransform={{ width: 400 }}>
      {platform === 'mobile' ? <Label value="phone" /> : <Label value="desk" />}
    </UiEntity>
  )
}`)!.root;
      const variant = root.children[0];
      expect(variant.platformVariant).toBe(true);
      expect(variant.opaque).toBeUndefined();
      // Desktop first regardless of which side the mobile test is on.
      expect(variant.children.map(c => c.platform)).toEqual(['desktop', 'mobile']);
      expect(variant.children.map(c => c.uiText?.value)).toEqual(['desk', 'phone']);
    });

    it('should lay each branch out under the variant PARENT, not the variant', () => {
      const root = parse(`export function MyScreen() {
  const platform = usePlatform()
  return (
    <UiEntity>
      {platform === 'mobile' ? <Label value="a" /> : <Label value="b" />}
    </UiEntity>
  )
}`)!.root;
      const parent = root.entity as unknown as number;
      for (const branch of root.children[0].children) {
        expect(branch.uiTransform).toMatchObject({ parent });
      }
    });

    it('should accept a conditional as the component return', () => {
      const root = parse(`export function MyScreen() {
  const platform = usePlatform()
  return platform === 'mobile' ? <Label value="phone" /> : <UiEntity uiTransform={{ width: 9 }} />
}`)!.root;
      expect(root.platformVariant).toBe(true);
      // A root-level variant's branches are roots too — no parent, so the canvas
      // treats each as the full-screen root rather than a positioned child.
      expect(root.children.map(c => c.uiTransform?.parent)).toEqual([undefined, undefined]);
      expect(root.children[0].uiTransform).toMatchObject({ width: 9 });
    });

    it('should expose only the authored branch of a one-sided conditional', () => {
      const root = parse(`export function MyScreen() {
  const platform = usePlatform()
  return (
    <UiEntity>
      {platform === 'mobile' ? <Label value="phone" /> : null}
    </UiEntity>
  )
}`)!.root;
      expect(root.children[0].children.map(c => c.platform)).toEqual(['mobile']);
    });

    it('should leave a non-platform conditional opaque', () => {
      const root = parse(`export function MyScreen() {
  return (
    <UiEntity>
      {state.open ? <Label value="a" /> : <Label value="b" />}
    </UiEntity>
  )
}`)!.root;
      expect(root.children[0].opaque?.reason).toBe('conditional');
      expect(root.children[0].platformVariant).toBeUndefined();
    });
  });

  describe('and a prop value is a non-literal expression', () => {
    const source = `export function S() {
  return <UiEntity uiTransform={dynamicTransform} />
}`;

    it('should keep the node but flag dynamicProps and skip the unresolved value', () => {
      const root = parse(source)!.root;
      expect(root.opaque).toBeUndefined();
      expect(root.dynamicProps).toBe(true);
      expect(root.uiTransform).toBeUndefined();
    });
  });

  describe('and a uiTransform KEY is bound to a variable', () => {
    it('should record it as a binding rather than freezing the node', () => {
      const root = parse(`export function S() {
  return <UiEntity uiTransform={{ width: 100, zIndex: state.depth }} />
}`)!.root;

      expect(root.dynamicProps).toBeUndefined();
      expect(root.bindings).toEqual([
        { field: 'core::UiTransform.zIndex', variable: 'state.depth' },
      ]);
    });

    it('should keep the statically readable siblings', () => {
      const root = parse(`export function S() {
  return <UiEntity uiTransform={{ width: 100, zIndex: state.depth }} />
}`)!.root;

      expect(root.uiTransform?.width).toBe(100);
    });

    it('should still freeze on a value that is neither literal nor a plain reference', () => {
      const root = parse(`export function S() {
  return <UiEntity uiTransform={{ zIndex: wide ? 1 : 2 }} />
}`)!.root;

      expect(root.dynamicProps).toBe(true);
    });
  });

  describe('and a uiBackground TEXTURE member is bound', () => {
    it('should record an image src binding under its dotted path', () => {
      const root = parse(`export function S() {
  return <UiEntity uiBackground={{ texture: { src: state.icon } }} />
}`)!.root;

      expect(root.dynamicProps).toBeUndefined();
      expect(root.bindings).toEqual([
        { field: 'core::UiBackground.texture.src', variable: 'state.icon' },
      ]);
    });

    it('should keep the node in image mode so the editor still shows it', () => {
      const root = parse(`export function S() {
  return <UiEntity uiBackground={{ texture: { src: state.icon } }} />
}`)!.root;

      expect((root.uiBackground as any)?.texture?.tex?.$case).toBe('texture');
    });

    it('should record an avatar userId binding under its dotted path', () => {
      const root = parse(`export function S() {
  return <UiEntity uiBackground={{ avatarTexture: { userId: state.who } }} />
}`)!.root;

      expect(root.dynamicProps).toBeUndefined();
      expect(root.bindings).toEqual([
        { field: 'core::UiBackground.avatarTexture.userId', variable: 'state.who' },
      ]);
    });
  });

  describe('and a uiBackground KEY is bound to a variable', () => {
    it('should record it as a binding rather than freezing the node', () => {
      const root = parse(`export function S() {
  return <UiEntity uiBackground={{ color: state.tint }} />
}`)!.root;

      expect(root.dynamicProps).toBeUndefined();
      expect(root.bindings).toEqual([
        { field: 'core::UiBackground.color', variable: 'state.tint' },
      ]);
    });
  });

  describe('and the component is the stock scene template (arrow/const export)', () => {
    // The default Decentraland scene ships this exact ui.tsx shape: a `setupUi`
    // helper (returns no JSX) plus an arrow-const `uiMenu` with a parenthesized
    // concise body. Both must be handled — skip `setupUi`, read `uiMenu`.
    const source = `import ReactEcs, { ReactEcsRenderer, UiEntity } from "@dcl/sdk/react-ecs"

export function setupUi() {
    ReactEcsRenderer.setUiRenderer(uiMenu, { virtualWidth: 1920, virtualHeight: 1080 })
}

export const uiMenu = () => (
    <UiEntity uiTransform={{ width: 300 }}>
    </UiEntity>
)`;

    it('should find and map the arrow-const component, skipping the JSX-less helper', () => {
      const parsed = parse(source);
      expect(parsed).not.toBeNull();
      expect(parsed!.root.type).toBe('UiEntity');
      expect(parsed!.root.uiTransform).toEqual({ width: 300, widthUnit: YGU_POINT });
      // The span points at the real <UiEntity>, so write-path splices land right.
      expect(source.slice(parsed!.root.span[0], parsed!.root.span[1]).startsWith('<UiEntity')).toBe(
        true,
      );
    });
  });

  describe('and the arrow component uses a block body with a return', () => {
    const source = `export const Hud = () => {
  return <UiEntity uiTransform={{ height: 50 }} />
}`;

    it('should read the returned JSX from the block body', () => {
      const parsed = parse(source);
      expect(parsed).not.toBeNull();
      expect(parsed!.root.type).toBe('UiEntity');
      expect(parsed!.root.uiTransform).toEqual({ height: 50, heightUnit: YGU_POINT });
    });
  });

  describe('and there is no component returning JSX', () => {
    it('should return null', () => {
      const parsed = parse('export const x = 1');
      expect(parsed).toBeNull();
    });
  });
});

describe('when an element carries a @ui-name marker', () => {
  it('should read it onto the node, per element', () => {
    const parsed = parse(`export function MyScreen() {
  return (
    <UiEntity /* @ui-name Sidebar */ uiTransform={{ width: 100 }}>
      <Label /* @ui-name Title */ value="x" />
      <Label value="unnamed" />
    </UiEntity>
  )
}
`);
    const root = parsed!.root as CodeUINode;
    expect(root.uiName).toBe('Sidebar');
    expect(root.children[0].uiName).toBe('Title');
    expect(root.children[1].uiName).toBeUndefined();
  });

  it('should leave an unnamed parent unnamed when only its child is named', () => {
    const parsed = parse(`export function MyScreen() {
  return (
    <UiEntity uiTransform={{ width: 100 }}>
      <Label /* @ui-name Title */ value="x" />
    </UiEntity>
  )
}
`);
    expect((parsed!.root as CodeUINode).uiName).toBeUndefined();
  });
});

describe('when locating the exported component identifier (for rename)', () => {
  const prog = (src: string) => parseSync('MyScreen.tsx', src).program as any;

  it('should return the id span of an `export function` component', () => {
    const src = 'export function MainUI() { return <UiEntity /> }';
    const span = findComponentIdSpan(prog(src), 'MainUI');
    expect(src.slice(span!.start, span!.end)).toBe('MainUI');
  });

  it('should return the id span of an `export const arrow` component', () => {
    const src = 'export const Hud = () => <UiEntity />';
    const span = findComponentIdSpan(prog(src), 'Hud');
    expect(src.slice(span!.start, span!.end)).toBe('Hud');
  });

  it('should not match a name that appears only in a string literal', () => {
    const src = 'export function MainUI() { return <Label value="MainUI" /> }';
    const span = findComponentIdSpan(prog(src), 'MainUI');
    // The returned span is the declaration id, never the literal.
    expect(span!.start).toBeLessThan(src.indexOf('value='));
  });

  it('should return null when no matching component exists', () => {
    expect(findComponentIdSpan(prog('const x = 1'), 'MainUI')).toBeNull();
  });
});

describe('when a JSX element references another editor root (component nesting)', () => {
  function parseWith(source: string, knownComponents: string[]) {
    const result = parseSync('MainUI.tsx', source);
    expect(result.errors).toHaveLength(0);
    return codeToUINodes(result.program as any, source, { knownComponents });
  }

  const source = `/** @jsx ReactEcs.createElement */
import ReactEcs, { UiEntity } from '@dcl/sdk/react-ecs'
import { OtroNombre } from './OtroNombre'

export function MainUI() {
  return (
    <UiEntity uiTransform={{ width: 400, height: 200 }}>
      <OtroNombre />
      <Foreign />
    </UiEntity>
  )
}
`;

  it('maps a known component to a first-class component-ref node (not opaque)', () => {
    const parsed = parseWith(source, ['OtroNombre'])!;
    const ref = parsed.root.children[0];
    expect(ref.componentRef).toEqual({ name: 'OtroNombre', props: [] });
    expect(ref.opaque).toBeUndefined();
    // Its span/AST are registered so move/remove/duplicate splices work.
    expect(parsed.astNodes.get(ref.entity as unknown as number)).toBeTruthy();
    // The structural parent is recorded so the canvas lays it out.
    expect((ref.uiTransform as any).parent).toBe(parsed.root.entity);
  });

  it('leaves an unknown custom component opaque', () => {
    const parsed = parseWith(source, ['OtroNombre'])!;
    const foreign = parsed.root.children[1];
    expect(foreign.componentRef).toBeUndefined();
    expect(foreign.opaque?.reason).toBe('custom-component');
  });

  it('keeps a component opaque when it is not in knownComponents', () => {
    const parsed = parseWith(source, [])!;
    expect(parsed.root.children[0].opaque?.reason).toBe('custom-component');
    expect(parsed.root.children[0].componentRef).toBeUndefined();
  });

  it('parses the instance prop values (literal → value, expression → expr)', () => {
    const withProps = `/** @jsx ReactEcs.createElement */
import ReactEcs, { UiEntity } from '@dcl/sdk/react-ecs'
import { Card } from './Card'

export function MainUI() {
  return (
    <UiEntity>
      <Card title="Hi" count={5} active={state.on} />
    </UiEntity>
  )
}
`;
    const parsed = parseWith(withProps, ['Card'])!;
    expect(parsed.root.children[0].componentRef).toEqual({
      name: 'Card',
      props: [
        { name: 'title', value: 'Hi' },
        { name: 'count', value: 5 },
        { name: 'active', expr: 'state.on' },
      ],
    });
  });
});

describe('when parsing Input / Dropdown / Button props (form coverage)', () => {
  function parseTree(source: string) {
    const r = parseSync('S.tsx', source);
    expect(r.errors).toHaveLength(0);
    const parsed = codeToUINodes(r.program as any, source)!;
    expect(parsed).not.toBeNull();
    return parsed;
  }

  it('folds Input props into uiInput (textAlign/font normalized to enums)', () => {
    const parsed = parseTree(`export function S() {
  return (
    <UiEntity>
      <Input placeholder="Name" fontSize={18} color={{ r: 1, g: 1, b: 1, a: 1 }} font="serif" />
    </UiEntity>
  )
}`);
    const input = parsed.root.children[0];
    expect(input.type).toBe('Input');
    expect(input.uiInput).toMatchObject({ placeholder: 'Name', fontSize: 18, font: 1 });
  });

  it('folds Dropdown props into uiDropdown, keeping the options array', () => {
    const parsed = parseTree(`export function S() {
  return (
    <UiEntity>
      <Dropdown options={['A', 'B']} selectedIndex={1} emptyLabel="Pick one" />
    </UiEntity>
  )
}`);
    const dd = parsed.root.children[0];
    expect(dd.type).toBe('Dropdown');
    expect(dd.uiDropdown).toMatchObject({
      options: ['A', 'B'],
      selectedIndex: 1,
      emptyLabel: 'Pick one',
    });
  });

  it('folds Button text props into uiText (Button extends UiLabelProps)', () => {
    const parsed = parseTree(`export function S() {
  return (
    <UiEntity>
      <Button value="Click me" fontSize={18} />
    </UiEntity>
  )
}`);
    const btn = parsed.root.children[0];
    expect(btn.type).toBe('Button');
    expect(btn.uiText).toMatchObject({ value: 'Click me', fontSize: 18 });
  });

  it('records a bound Input value as a binding row (not opaque)', () => {
    const parsed = parseTree(`export function S() {
  return (
    <UiEntity>
      <Input placeholder="Name" value={state.name} />
    </UiEntity>
  )
}`);
    const input = parsed.root.children[0];
    expect(input.bindings).toEqual(
      expect.arrayContaining([{ field: 'core::UiInput.value', variable: 'state.name' }]),
    );
  });

  it('reads the handler name from a value-bearing thunk (typed param, as the editor emits)', () => {
    const parsed = parseTree(`export function S() {
  return (
    <UiEntity>
      <Input onChange={(value: string | number) => onType(state, value)} />
    </UiEntity>
  )
}`);
    const input = parsed.root.children[0];
    expect(input.bindings).toEqual(
      expect.arrayContaining([{ field: 'core::UiInput.onChange', variable: 'onType' }]),
    );
  });
});
