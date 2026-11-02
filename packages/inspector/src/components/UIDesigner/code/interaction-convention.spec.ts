import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';

import { applyEdits, toBlockBody } from './emit-adapter';
import {
  addInteractionState,
  findInteractionForSpread,
  type InteractionAst,
  interactionStatement,
  parseInteractionCall,
  removeInteractionState,
  setInteractionActive,
  setInteractionFlat,
  setInteractionNested,
  soleSpreadArgument,
  unwrapInteractionEdits,
  wrapInInteractionEdits,
} from './interaction-convention';
import { findComponentFn } from './parse-adapter';

// These helpers take the raw ESTree PROGRAM, so obtain it via parseSync directly.
const prog = (source: string) => parseSync('Ui.tsx', source).program as any;

// Locate the returned JSX element's sole spread and resolve it, mirroring what
// parse-adapter does at the `hasSpread` gate.
function resolve(source: string): InteractionAst | null {
  const program = prog(source);
  const fn = findComponentFn(program) as any;
  const body = fn?.body?.body ?? [];
  const ret = body.find((s: any) => s.type === 'ReturnStatement');
  let jsx = ret?.argument;
  while (jsx?.type === 'ParenthesizedExpression') jsx = jsx.expression;
  return findInteractionForSpread(soleSpreadArgument(jsx), fn);
}

const CONST_FORM = `export function Ui() {
  const btn = useInteraction({
    base: { uiBackground: { color: { r: 1, g: 1, b: 1, a: 1 } } },
    hover: { uiBackground: { color: { r: 0, g: 0, b: 1, a: 1 } } },
  })
  return <UiEntity {...btn} />
}`;

describe('when parsing the interaction convention', () => {
  it('should resolve the const form through its identifier', () => {
    const ast = resolve(CONST_FORM);
    expect(ast?.name).toBe('btn');
    expect([...(ast?.states.keys() ?? [])]).toEqual(['base', 'hover']);
    expect(ast?.declarator).toBeTruthy();
  });

  it('should resolve an inline spread of the call', () => {
    const ast = resolve(
      `export function Ui() {
        return <UiEntity {...useInteraction({ press: { uiTransform: { width: 10 } } })} />
      }`,
    );
    expect([...(ast?.states.keys() ?? [])]).toEqual(['press']);
    expect(ast?.name).toBeUndefined();
  });

  it('should read the active-flag argument', () => {
    const ast = resolve(
      `export function Ui() {
        const btn = useInteraction({ active: { uiTransform: { width: 5 } } }, state.selected)
        return <UiEntity {...btn} />
      }`,
    );
    expect(ast?.activeArg).toBeTruthy();
  });

  it('should ignore unknown layer keys', () => {
    const ast = resolve(
      `export function Ui() {
        const btn = useInteraction({ base: {}, bogus: { uiTransform: {} } })
        return <UiEntity {...btn} />
      }`,
    );
    expect([...(ast?.states.keys() ?? [])]).toEqual(['base']);
  });

  it('should not resolve a spread that is not an interaction', () => {
    expect(
      resolve(`export function Ui() {
        const other = { uiTransform: { width: 1 } }
        return <UiEntity {...other} />
      }`),
    ).toBeNull();
  });

  it('should refuse a non-object layers map so the node stays opaque', () => {
    expect(
      parseInteractionCall(prog('const x = useInteraction(layers)').body[0].declarations[0].init),
    ).toBeNull();
  });
});

describe('when writing interaction layers', () => {
  const reparse = (src: string) => resolve(src)!;

  it('should patch a field in an existing layer without touching siblings', () => {
    const ast = reparse(CONST_FORM);
    const next = applyEdits(
      CONST_FORM,
      setInteractionNested(ast, 'hover', 'uiBackground', { color: { r: 1, g: 0, b: 0, a: 1 } }),
    );
    expect(next).toContain('hover: { uiBackground: { color: { r: 1, g: 0, b: 0, a: 1 } } }');
    // The base layer is untouched.
    expect(next).toContain('base: { uiBackground: { color: { r: 1, g: 1, b: 1, a: 1 } } }');
  });

  it('should merge into an existing bag rather than replacing it', () => {
    const src = `export function Ui() {
  const btn = useInteraction({ hover: { uiBackground: { color: { r: 1, g: 1, b: 1, a: 1 }, textureMode: 'stretch' } } })
  return <UiEntity {...btn} />
}`;
    const next = applyEdits(
      src,
      setInteractionNested(reparse(src), 'hover', 'uiBackground', {
        color: { r: 0, g: 0, b: 0, a: 1 },
      }),
    );
    expect(next).toContain("textureMode: 'stretch'");
    expect(next).toContain('color: { r: 0, g: 0, b: 0, a: 1 }');
  });

  it('should create a layer that does not exist yet', () => {
    const next = applyEdits(
      CONST_FORM,
      setInteractionNested(reparse(CONST_FORM), 'press', 'uiTransform', { width: 42 }),
    );
    expect([...reparse(next).states.keys()]).toEqual(['base', 'hover', 'press']);
    expect(next).toContain('press: { uiTransform: { width: 42 } }');
  });

  it('should create a nested bag inside an existing layer', () => {
    const next = applyEdits(
      CONST_FORM,
      setInteractionNested(reparse(CONST_FORM), 'hover', 'uiTransform', { width: 7 }),
    );
    expect(next).toContain('uiTransform: { width: 7 }');
    expect(next).toContain('uiBackground: { color: { r: 0, g: 0, b: 1, a: 1 } }');
  });

  it('should patch flat element props on a layer', () => {
    const next = applyEdits(
      CONST_FORM,
      setInteractionFlat(reparse(CONST_FORM), 'hover', { fontSize: 24 }),
    );
    expect(next).toContain('fontSize: 24');
  });

  it('should remove a field when its value is undefined', () => {
    const next = applyEdits(
      CONST_FORM,
      setInteractionNested(reparse(CONST_FORM), 'hover', 'uiBackground', { color: undefined }),
    );
    expect(next).toContain('hover: { uiBackground: {} }');
  });

  it('should add and remove whole layers', () => {
    const added = applyEdits(CONST_FORM, addInteractionState(reparse(CONST_FORM), 'active'));
    expect([...reparse(added).states.keys()]).toEqual(['base', 'hover', 'active']);
    const removed = applyEdits(added, removeInteractionState(reparse(added), 'hover'));
    expect([...reparse(removed).states.keys()]).toEqual(['base', 'active']);
  });

  it('should leave the sole remaining layer removable', () => {
    const src = `export function Ui() {
  const btn = useInteraction({ hover: { uiTransform: { width: 1 } } })
  return <UiEntity {...btn} />
}`;
    const next = applyEdits(src, removeInteractionState(reparse(src), 'hover'));
    expect([...reparse(next).states.keys()]).toEqual([]);
  });

  it('should set, replace and clear the active flag', () => {
    const set = applyEdits(CONST_FORM, setInteractionActive(reparse(CONST_FORM), 'state.selected'));
    expect(set).toContain('}, state.selected)');

    const replaced = applyEdits(set, setInteractionActive(reparse(set), 'state.on'));
    expect(replaced).toContain('}, state.on)');
    expect(replaced).not.toContain('state.selected');

    const cleared = applyEdits(replaced, setInteractionActive(reparse(replaced), undefined));
    expect(cleared).toContain('})');
    expect(cleared).not.toContain('state.on');
    expect(reparse(cleared).activeArg).toBeUndefined();
  });
});

describe('when wrapping an element into interaction states', () => {
  const PLAIN = `/** @jsx ReactEcs.createElement */
import ReactEcs, { UiEntity } from '@dcl/sdk/react-ecs'

export function Ui() {
  return (
    <UiEntity
      key="k"
      uiTransform={{ width: 400, height: 200 }}
      uiBackground={{ color: { r: 1, g: 1, b: 1, a: 1 } }}
      onMouseDown={() => onClick({ state, props })}
    />
  )
}
`;

  // Mirrors parse-adapter.isLayerableProp for a UiEntity (the store injects the
  // real one); `key` is deliberately NOT layerable.
  const isLayerable = (n: string) =>
    n === 'uiTransform' || n === 'uiBackground' || n.startsWith('onMouse');

  function wrap(source: string) {
    const program = prog(source);
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
        name: 'entityStyles',
        importFrom: './interaction',
        isLayerable,
      }),
    );
  }

  it('should produce source that parses back as a recognized interaction', () => {
    const next = wrap(PLAIN);
    expect(parseSync('Ui.tsx', next).errors).toHaveLength(0);
    const ast = resolve(next);
    expect(ast?.name).toBe('entityStyles');
    expect([...(ast?.states.keys() ?? [])]).toEqual(['base']);
  });

  it('should move modeled props into base and leave unmodeled ones on the element', () => {
    const next = wrap(PLAIN);
    expect(next).toContain('uiTransform: { width: 400, height: 200 }');
    expect(next).toContain('onMouseDown: () => onClick({ state, props })');
    // `key` is not a style/event the editor models — it stays an attribute.
    expect(next).toMatch(/<UiEntity[\s\S]*key="k"/);
    expect(next).not.toContain('uiTransform={{');
  });

  it('should add the helper import and spread the const first', () => {
    const next = wrap(PLAIN);
    expect(next).toContain("import { useInteraction } from './interaction'");
    expect(next).toMatch(/<UiEntity\s+\{\.\.\.entityStyles\}/);
  });

  it('should round-trip an element with no props', () => {
    const next = wrap(`export function Ui() {
  return <UiEntity />
}`);
    expect(parseSync('Ui.tsx', next).errors).toHaveLength(0);
    expect(next).toContain('useInteraction({ base: {} })');
  });

  // The store converts a concise-body arrow to a block FIRST (toBlockBody), then
  // wraps against the reparsed source — insertStatementBeforeReturn has no block
  // to splice into otherwise, and a missing `const` would leave the spread
  // referencing nothing, collapsing the node to opaque (i.e. invisible).
  it('should wrap a concise-body arrow component after converting it to a block', () => {
    const src = `/** @jsx ReactEcs.createElement */
import ReactEcs, { UiEntity } from '@dcl/sdk/react-ecs'

export const Hud = () => <UiEntity uiTransform={{ width: 10 }} />
`;
    const p0 = prog(src);
    const fn0 = findComponentFn(p0) as any;
    const toBlock = toBlockBody(fn0, src);
    expect(toBlock.length).toBeGreaterThan(0);
    const blocked = applyEdits(src, toBlock);
    expect(parseSync('Ui.tsx', blocked).errors).toHaveLength(0);

    const next = wrap(blocked);
    expect(parseSync('Ui.tsx', next).errors).toHaveLength(0);
    expect(next).toContain('const entityStyles = useInteraction(');
    const ast = resolve(next);
    expect(ast?.name).toBe('entityStyles');
    expect(ast?.states.get('base')).toBeTruthy();
  });

  it('should restore base props onto the element when unwrapped', () => {
    const wrapped = wrap(PLAIN);
    const ast = resolve(wrapped)!;
    const program = prog(wrapped);
    const fn = findComponentFn(program) as any;
    const ret = (fn?.body?.body ?? []).find((s: any) => s.type === 'ReturnStatement');
    let el = ret?.argument;
    while (el?.type === 'ParenthesizedExpression') el = el.expression;

    const back = applyEdits(wrapped, unwrapInteractionEdits(ast, el, wrapped));
    expect(parseSync('Ui.tsx', back).errors).toHaveLength(0);
    expect(back).toContain('uiTransform={{ width: 400, height: 200 }}');
    expect(back).toContain('onMouseDown={() => onClick({ state, props })}');
    expect(back).not.toContain('useInteraction(');
    expect(resolve(back)).toBeNull();
  });
});

describe('when building the interaction statement', () => {
  it('should carry the current props into the base layer', () => {
    expect(interactionStatement('btn', 'uiBackground: { color: WHITE }')).toBe(
      'const btn = useInteraction({ base: { uiBackground: { color: WHITE } } })',
    );
  });

  it('should emit an empty base for a node with no styles', () => {
    expect(interactionStatement('btn', '')).toBe('const btn = useInteraction({ base: {} })');
  });
});
