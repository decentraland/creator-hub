import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';

import {
  YGPT_ABSOLUTE,
  YGPT_RELATIVE,
  YGU_POINT,
  YGU_UNDEFINED,
} from '../../lib/sdk/ui-transform-constants';
import { applyEdits } from './code/emit-adapter';
import { codeToUINodes } from './code/parse-adapter';
import { uiTransformPatchEdits } from './code/transform-patch';
import { POSITION_GROUP } from './field-configs';
import {
  absolutePatch,
  FLOW_DIRECTIONS,
  flowPatch,
  flowValue,
  isWrapping,
  wrapPatch,
} from './flow';

function parseRoot(source: string) {
  const r = parseSync('S.tsx', source);
  expect(r.errors).toHaveLength(0);
  const parsed = codeToUINodes(r.program as any, source)!;
  expect(parsed).not.toBeNull();
  return parsed;
}

function transformOf(source: string): Record<string, unknown> {
  return (parseRoot(source).root.uiTransform as Record<string, unknown>) ?? {};
}

// Apply a Flow patch the way the panel does: through the same span-splicing
// transform patcher, then re-parse, so what is asserted is what lands in SOURCE.
function patchRoot(source: string, patch: Record<string, unknown>): string {
  const parsed = parseRoot(source);
  const ast = parsed.astNodes.get(parsed.root.entity as unknown as number) as any;
  const current = (parsed.root.uiTransform as Record<string, unknown>) ?? {};
  return applyEdits(source, uiTransformPatchEdits(ast, current, patch));
}

const gatedField = (label: string) =>
  POSITION_GROUP.fields.find(f => f.label === label) as {
    disabledWhen?: (v: Record<string, unknown>) => boolean;
  };

describe('the Flow control', () => {
  describe('when reading the current cell', () => {
    it('should read the flex direction for an in-flow node', () => {
      expect(flowValue({ flexDirection: FLOW_DIRECTIONS.column })).toBe('column');
      expect(flowValue({ flexDirection: FLOW_DIRECTIONS['row-reverse'] })).toBe('row-reverse');
    });

    it('should default an unauthored direction to row, matching react-ecs', () => {
      expect(flowValue({})).toBe('row');
      expect(flowValue(null)).toBe('row');
    });

    it('should read absolute regardless of the direction underneath', () => {
      expect(
        flowValue({ positionType: YGPT_ABSOLUTE, flexDirection: FLOW_DIRECTIONS.column }),
      ).toBe('absolute');
    });
  });

  describe('when picking a cell', () => {
    it('should do nothing when the cell is already selected', () => {
      expect(flowPatch('row', 'row', null)).toBeNull();
      expect(flowPatch('absolute', 'absolute', null)).toBeNull();
    });

    // The regression this control was flagged for: positionType and flexDirection
    // are orthogonal, so going absolute must hide the direction, not destroy it.
    it('should NOT write flexDirection when picking absolute', () => {
      const patch = flowPatch('absolute', 'column', { top: 10, left: 20 })!;
      expect(patch).not.toHaveProperty('flexDirection');
      expect(patch.positionType).toBe(YGPT_ABSOLUTE);
      expect(patch.positionTop).toBe(10);
      expect(patch.positionLeft).toBe(20);
    });

    // The measured offset is where the node's MARGIN put it, and Yoga adds the
    // leading margin to an absolute node's leading inset — so keeping the margins
    // would move the node by its own margin, which is what baking the offset is
    // meant to prevent.
    it('should clear the margins when baking the offset', () => {
      expect(absolutePatch({ top: 32, left: 8 })).toMatchObject({
        positionTop: 32,
        positionLeft: 8,
        marginTop: 0,
        marginTopUnit: YGU_UNDEFINED,
        marginRight: 0,
        marginRightUnit: YGU_UNDEFINED,
        marginBottom: 0,
        marginBottomUnit: YGU_UNDEFINED,
        marginLeft: 0,
        marginLeftUnit: YGU_UNDEFINED,
      });
    });

    // The selector's absolute cell and the "Ignore Layout Flow" checkbox (the
    // panel's position-mode field) share this one builder, so the margin fix
    // covers both paths.
    it('should build the absolute cell from the shared patch', () => {
      expect(flowPatch('absolute', 'column', { top: 32, left: 8 })).toEqual(
        absolutePatch({ top: 32, left: 8 }),
      );
    });

    it('should reset the baked offsets only when leaving absolute', () => {
      const leaving = flowPatch('row', 'absolute', null)!;
      expect(leaving.positionType).toBe(YGPT_RELATIVE);
      expect(leaving.flexDirection).toBe(FLOW_DIRECTIONS.row);

      // Already in flow: a direction pick must not touch position offsets a hand
      // author may have written.
      const staying = flowPatch('column', 'row', null)!;
      expect(staying).toEqual({ flexDirection: FLOW_DIRECTIONS.column });
    });
  });

  describe('when toggling wrap', () => {
    it('should read any non-zero flexWrap as wrapping', () => {
      expect(isWrapping({})).toBe(false);
      expect(isWrapping({ flexWrap: 0 })).toBe(false);
      expect(isWrapping({ flexWrap: 1 })).toBe(true);
      // wrap-reverse is still wrapping — the toggle must not read it as off.
      expect(isWrapping({ flexWrap: 2 })).toBe(true);
    });

    it('should write only flexWrap', () => {
      expect(wrapPatch(true)).toEqual({ flexWrap: 1 });
      expect(wrapPatch(false)).toEqual({ flexWrap: 0 });
    });
  });

  // The end-to-end assertion from the plan: the value has to survive the splice,
  // not merely the patch builder.
  describe('when a column container is switched to absolute in source', () => {
    const SOURCE = `export function S() {
  return <UiEntity uiTransform={{ width: 100, height: 50, flexDirection: 'column' }} />
}`;

    it('should keep flexDirection in the file', () => {
      const before = transformOf(SOURCE);
      expect(flowValue(before)).toBe('column');

      const next = patchRoot(SOURCE, flowPatch('absolute', 'column', { top: 12, left: 34 })!);
      expect(next).toContain("flexDirection: 'column'");

      const after = transformOf(next);
      expect(after.flexDirection).toBe(FLOW_DIRECTIONS.column);
      expect(after.positionType).toBe(YGPT_ABSOLUTE);
      expect(after.positionTop).toBe(12);
      expect(after.positionTopUnit).toBe(YGU_POINT);
      expect(after.positionLeft).toBe(34);
    });

    it('should show absolute selected, enable Anchor/Position, and check the flow checkbox', () => {
      const after = transformOf(patchRoot(SOURCE, flowPatch('absolute', 'column', null)!));

      expect(flowValue(after)).toBe('absolute');
      // Both gated Position fields become live…
      expect(gatedField('Anchor').disabledWhen?.(after)).toBe(false);
      expect(gatedField('Position').disabledWhen?.(after)).toBe(false);
      // …and the "Ignore Layout Flow" checkbox mirrors the same value.
      expect(after.positionType).toBe(YGPT_ABSOLUTE);
    });

    // A centered anchor's counter-margin is half the node's own width, which in
    // flow reads as an unexplained overlap with its siblings.
    it('should clear a centered anchor counter-margin when leaving absolute', () => {
      const centered = {
        positionType: YGPT_ABSOLUTE,
        positionLeft: 50,
        positionLeftUnit: 2,
        marginLeft: -40,
        marginLeftUnit: YGU_POINT,
      };
      const patch = flowPatch('row', 'absolute', null, centered)!;
      expect(patch.marginLeft).toBe(0);
      expect(patch.marginLeftUnit).toBe(YGU_UNDEFINED);
      // A node pinned by px edges has no counter-margin to clear.
      expect(
        flowPatch('row', 'absolute', null, { positionType: YGPT_ABSOLUTE })!,
      ).not.toHaveProperty('marginLeft');
    });

    it('should restore the hidden direction when switched back in flow', () => {
      const absolute = patchRoot(SOURCE, flowPatch('absolute', 'column', { top: 12, left: 34 })!);
      const backInFlow = patchRoot(absolute, flowPatch('column', 'absolute', null)!);

      const after = transformOf(backInFlow);
      expect(flowValue(after)).toBe('column');
      // The baked offsets are gone — Yoga honours position* on relative nodes too.
      expect(after.positionTop).toBeUndefined();
      expect(after.positionLeft).toBeUndefined();
      expect(backInFlow).not.toContain('position:');
    });
  });

  describe('when a node with margins is switched to absolute in source', () => {
    const SOURCE = `export function S() {
  return <UiEntity uiTransform={{ width: 100, height: 50, margin: { top: 32, left: 8 } }} />
}`;

    it('should drop the margins so the node stays where it was measured', () => {
      expect(transformOf(SOURCE).marginTop).toBe(32);

      // 32/8 is the offset the margin itself produced; Yoga would add it a second
      // time on top of an absolute inset, landing the node at 64/16.
      const next = patchRoot(SOURCE, flowPatch('absolute', 'row', { top: 32, left: 8 })!);
      expect(next).not.toContain('margin');

      const after = transformOf(next);
      expect(after.positionTop).toBe(32);
      expect(after.positionLeft).toBe(8);
      expect(after.marginTop).toBeUndefined();
      expect(after.marginLeft).toBeUndefined();
    });
  });
});
