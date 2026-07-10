import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';

import { YGPT_ABSOLUTE, YGU_POINT } from '../../../lib/sdk/ui-transform-constants';
import { generateRootComponent, generateUiIndex } from './aggregator';
import { pbToErgonomicTransform } from './ecs-shape';
import { applyEdits, insertChild, moveElement, setAttribute, setObjectField } from './emit-adapter';
import { codeToUINodes } from './parse-adapter';
import type { CodeUINode } from './types';

// End-to-end guarantee for the code-as-source pipeline: the OXC parser reads the
// code WE generate (aggregator.ts), the canvas tree derived from it is correct,
// and a canvas edit splices back into that same code and re-parses cleanly.
// This is the "parse our generated code + canvas <-> code" contract, exercised
// purely on generated source (no hand-authored / arbitrary input).

function parse(filename: string, source: string) {
  const result = parseSync(filename, source);
  expect(result.errors).toHaveLength(0);
  const parsed = codeToUINodes(result.program as any, source);
  expect(parsed).not.toBeNull();
  return parsed!;
}

describe('when round-tripping a generated root file (code <-> canvas)', () => {
  it('should parse the generated root and derive the expected canvas tree', () => {
    const source = generateRootComponent('MyScreen');
    const { root } = parse('MyScreen.tsx', source);
    expect(root.type).toBe('UiEntity');
    const label = root.children[0] as CodeUINode;
    expect(label.type).toBe('Label');
    expect(label.uiText).toEqual({ value: 'MyScreen', fontSize: 32 });
    // No opaque nodes: everything we generate is representable.
    expect(root.opaque).toBeUndefined();
    expect(label.opaque).toBeUndefined();
  });

  it('should reflect a canvas resize back into the generated code (canvas -> code)', () => {
    const source = generateRootComponent('MyScreen');
    const parsed = parse('MyScreen.tsx', source);
    const rootAst = parsed.astNodes.get(parsed.root.entity as unknown as number) as any;

    // Simulate the canvas resize op: set uiTransform.width on the root element.
    const edited = applyEdits(source, setObjectField(rootAst, 'uiTransform', 'width', 500));

    // Re-parse: the canvas must now see the new width (normalized to PB shape).
    const reparsed = parse('MyScreen.tsx', edited);
    expect((reparsed.root.uiTransform as any).width).toBe(500);
    expect((reparsed.root.uiTransform as any).widthUnit).toBe(YGU_POINT);
    // The untouched Label survived the splice verbatim.
    expect((reparsed.root.children[0] as CodeUINode).uiText).toEqual({
      value: 'MyScreen',
      fontSize: 32,
    });
  });

  it('should reflect a canvas add-child back into the generated code (canvas -> code)', () => {
    const source = generateRootComponent('MyScreen');
    const parsed = parse('MyScreen.tsx', source);
    const rootAst = parsed.astNodes.get(parsed.root.entity as unknown as number) as any;

    const edited = applyEdits(
      source,
      insertChild(rootAst, source, '<Label value="Added" fontSize={18} />'),
    );

    const reparsed = parse('MyScreen.tsx', edited);
    const labels = reparsed.root.children.filter(c => c.type === 'Label');
    expect(labels).toHaveLength(2);
    expect((labels[1] as CodeUINode).uiText).toEqual({ value: 'Added', fontSize: 18 });
  });

  it('should reorder siblings by moving element source (canvas/tree reorder → code)', () => {
    const source = `import ReactEcs, { UiEntity, Label } from '@dcl/sdk/react-ecs'
export function MainUI() {
  return (
    <UiEntity>
      <Label value="A" />
      <Label value="B" />
    </UiEntity>
  )
}`;
    const parsed = parse('MainUI.tsx', source);
    expect(parsed.root.children.map(c => (c.uiText as any).value)).toEqual(['A', 'B']);
    const a = parsed.astNodes.get(parsed.root.children[0].entity as unknown as number) as any;
    const b = parsed.astNodes.get(parsed.root.children[1].entity as unknown as number) as any;

    // Move B before A (the reorder splice) → the reparsed tree flips the order.
    const edited = applyEdits(source, moveElement(source, b, a.start));
    const reparsed = parse('MainUI.tsx', edited);
    expect(reparsed.root.children.map(c => (c.uiText as any).value)).toEqual(['B', 'A']);
  });

  it('should mark children with a parent so the canvas treats only the root as root', () => {
    const source = generateRootComponent('MyScreen');
    const { root } = parse('MyScreen.tsx', source);
    // Root has no parent (fills the screen); the child carries the root's id.
    expect((root.uiTransform as any)?.parent).toBeUndefined();
    expect((root.children[0].uiTransform as any)?.parent).toBe(root.entity);
  });

  it('should move an in-flow node by splicing margin (canvas move → code)', () => {
    const source = generateRootComponent('MyScreen');
    const parsed = parse('MyScreen.tsx', source);
    const labelAst = parsed.astNodes.get(
      parsed.root.children[0].entity as unknown as number,
    ) as any;

    // Canvas move of an in-flow node → new margin (current + drag delta).
    const edited = applyEdits(
      source,
      setObjectField(labelAst, 'uiTransform', 'margin', { top: 100, left: 50 }),
    );
    const reparsed = parse('MyScreen.tsx', edited);
    const label = reparsed.root.children[0] as any;
    expect(label.uiTransform.marginTop).toBe(100);
    expect(label.uiTransform.marginLeft).toBe(50);
    // Stayed in flow — no positionType introduced.
    expect(label.uiTransform.positionType).toBeUndefined();
  });

  it('should switch an in-flow node to absolute via a whole-uiTransform re-emit (panel → code)', () => {
    const source = generateRootComponent('MyScreen');
    const parsed = parse('MyScreen.tsx', source);
    const label = parsed.root.children[0] as CodeUINode;
    const labelAst = parsed.astNodes.get(label.entity as unknown as number) as any;

    // Simulate the "Positioning → Absolute" panel patch: merge the node's current
    // PB transform with the patch, drop the synthetic parent, re-emit ergonomic.
    const merged: Record<string, unknown> = {
      ...(label.uiTransform as Record<string, unknown>),
      positionType: YGPT_ABSOLUTE,
      positionTop: 10,
      positionTopUnit: YGU_POINT,
      positionLeft: 20,
      positionLeftUnit: YGU_POINT,
    };
    delete merged.parent;
    const edited = applyEdits(
      source,
      setAttribute(labelAst, 'uiTransform', pbToErgonomicTransform(merged)),
    );

    const reparsed = parse('MyScreen.tsx', edited);
    const out = reparsed.root.children[0].uiTransform as any;
    expect(out.positionType).toBe(YGPT_ABSOLUTE);
    expect(out.positionTop).toBe(10);
    expect(out.positionLeft).toBe(20);
    // Existing size survived the re-emit.
    expect(out.width).toBe(360);
  });

  it('should generate a valid aggregator that composes every root', () => {
    const src = generateUiIndex([
      { component: 'MyScreen', from: './MyScreen' },
      { component: 'Hud', from: './Hud' },
    ]);
    // The aggregator itself is valid TSX (it is not canvas-edited — roots are).
    expect(parseSync('index.tsx', src).errors).toHaveLength(0);
    expect(src).toContain('<MyScreen />');
    expect(src).toContain('<Hud />');
  });

  it('should duplicate a child as a following sibling whose span starts one char past the original', () => {
    const src = generateRootComponent('MainUI');
    const parsed = parse('MainUI.tsx', src);
    const child = parsed.root.children[0];
    const [childStart, childEnd] = parsed.spans.get(child.entity as unknown as number)!;

    // The exact edit store.spliceDuplicate applies: insert `\n<copy>` at el.end.
    const raw = src.slice(childStart, childEnd);
    const next = applyEdits(src, [{ start: childEnd, end: childEnd, text: `\n${raw}` }]);

    const reparsed = parse('MainUI.tsx', next);
    expect(reparsed.root.children).toHaveLength(2);
    expect(reparsed.root.children[1].type).toBe(child.type);
    // The clone's span starts at the original end + 1 (the inserted '\n') — the
    // offset store.spliceDuplicate uses to recover the clone's new id.
    const cloneSpan = reparsed.spans.get(reparsed.root.children[1].entity as unknown as number)!;
    expect(cloneSpan[0]).toBe(childEnd + 1);
  });
});
