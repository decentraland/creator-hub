import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';

import { pbToErgonomicButton } from './ecs-shape';
import { applyEdits, setAttributes } from './emit-adapter';
import { codeToUINodes, isLayerableComponent, isLayerableProp, UI_BUTTON } from './parse-adapter';

function parse(source: string) {
  const r = parseSync('S.tsx', source);
  expect(r.errors).toHaveLength(0);
  const parsed = codeToUINodes(r.program as any, source)!;
  expect(parsed).not.toBeNull();
  return parsed;
}

// The store's write path for `ui::button` (spliceComponentPatch), composed from the
// same two functions: the panel's PB patch → ergonomic fields → attribute splices.
function patchRoot(source: string, patch: Record<string, unknown>): string {
  const parsed = parse(source);
  const ast = parsed.astNodes.get(parsed.root.entity as unknown as number) as any;
  return applyEdits(source, setAttributes(ast, source, pbToErgonomicButton(patch)));
}

const PRIMARY = 0;
const SECONDARY = 1;

describe("when reading a Button's own props", () => {
  it('should leave uiButton unset on a Button that authors neither', () => {
    const root = parse(`export function S() {
  return <Button value="Go" />
}`).root;
    expect(root.uiButton).toBeUndefined();
    expect(root.uiText).toEqual({ value: 'Go' });
  });

  it('should read variant as its numeric enum and disabled as a boolean', () => {
    const root = parse(`export function S() {
  return <Button value="Go" variant="secondary" disabled={true} />
}`).root;
    expect(root.uiButton).toEqual({ variant: SECONDARY, disabled: true });
  });

  it('should read a bare disabled attribute as true', () => {
    const root = parse(`export function S() {
  return <Button value="Go" disabled />
}`).root;
    expect(root.uiButton).toEqual({ disabled: true });
  });

  // An unknown variant string can't be shown by the panel's dropdown, and
  // re-emitting it is react-ecs's problem, not ours: drop it rather than surface a
  // value no option matches.
  it('should drop a variant spelling react-ecs does not accept', () => {
    const root = parse(`export function S() {
  return <Button variant="tertiary" />
}`).root;
    expect(root.uiButton).toBeUndefined();
    expect(root.dynamicProps).toBeUndefined();
  });

  // `variant={cond ? … : …}` is the idiomatic way to author a Button, and marking the
  // node dynamic over it would freeze every uiTransform/uiBackground write on it
  // (guardElementWrite) — protecting nothing, since the ui::button write path patches
  // one attribute at a time.
  it('should leave a Button with a computed variant editable', () => {
    const source = `export function S() {
  return <Button value="Go" variant={active ? 'primary' : 'secondary'} />
}`;
    const root = parse(source).root;
    expect(root.dynamicProps).toBeUndefined();
    expect(root.uiButton).toBeUndefined();
    expect(patchRoot(source, { disabled: true })).toContain(
      "variant={active ? 'primary' : 'secondary'}",
    );
  });

  it('should record a bound disabled as a binding rather than freezing the node', () => {
    const root = parse(`export function S() {
  return <Button value="Go" disabled={state.locked} />
}`).root;
    expect(root.bindings).toEqual([{ field: `${UI_BUTTON}.disabled`, variable: 'state.locked' }]);
    expect(root.uiButton).toBeUndefined();
    expect(root.dynamicProps).toBeUndefined();
  });

  it('should read neither prop off a Label, which has no such props', () => {
    const root = parse(`export function S() {
  return <Label value="Hi" variant="secondary" />
}`).root;
    expect(root.uiButton).toBeUndefined();
  });
});

describe("when writing a Button's own props", () => {
  it('should add both attributes to a Button that has neither', () => {
    const source = `export function S() {
  return <Button value="Go" />
}`;
    expect(patchRoot(source, { variant: SECONDARY })).toContain(
      '<Button variant="secondary" value="Go" />',
    );
    expect(patchRoot(source, { disabled: true })).toContain(
      '<Button disabled={true} value="Go" />',
    );
  });

  it('should replace an authored variant in place', () => {
    const next = patchRoot(
      `export function S() {
  return <Button value="Go" variant="secondary" uiTransform={{ width: 100 }} />
}`,
      { variant: PRIMARY },
    );
    expect(next).toContain('<Button value="Go" variant="primary" uiTransform={{ width: 100 }} />');
  });

  it('should remove the attribute when the panel unsets the prop', () => {
    const next = patchRoot(
      `export function S() {
  return <Button value="Go" variant="secondary" disabled={true} />
}`,
      { variant: undefined, disabled: undefined },
    );
    expect(next).toContain('<Button value="Go" />');
  });

  it('should round-trip a set value back through the parser', () => {
    let source = `export function S() {
  return <Button value="Go" />
}`;
    source = patchRoot(source, { variant: SECONDARY, disabled: true });
    expect(parse(source).root.uiButton).toEqual({ variant: SECONDARY, disabled: true });

    source = patchRoot(source, { variant: PRIMARY });
    expect(parse(source).root.uiButton).toEqual({ variant: PRIMARY, disabled: true });

    source = patchRoot(source, { disabled: undefined });
    expect(parse(source).root.uiButton).toEqual({ variant: PRIMARY });
    expect(parse(source).root.uiText).toEqual({ value: 'Go' });
  });

  // Both props must keep writing a plain JSX attribute even on a node whose styles
  // live in a `useInteraction` call: the spread is emitted BEFORE the attributes, so
  // a leftover attribute still wins — which is the behaviour we want here.
  it('should never route into an interaction layer', () => {
    expect(isLayerableProp('Button', 'variant')).toBe(false);
    expect(isLayerableProp('Button', 'disabled')).toBe(false);
    expect(isLayerableComponent(UI_BUTTON)).toBe(false);
    // An Input's `disabled` is a real PBUiInput field and stays layerable.
    expect(isLayerableProp('Input', 'disabled')).toBe(true);
    expect(isLayerableComponent('core::UiText')).toBe(true);
  });

  it('should keep reading a Button with interaction states from the element', () => {
    const root = parse(`export function S() {
  const styles = useInteraction({ base: { value: 'Go' }, hover: { uiBackground: { color: 'red' } } })
  return <Button {...styles} variant="secondary" />
}`).root;
    expect(root.uiButton).toEqual({ variant: SECONDARY });
    expect(root.interaction).toBeDefined();
    expect(root.dynamicProps).toBeUndefined();
  });
});
