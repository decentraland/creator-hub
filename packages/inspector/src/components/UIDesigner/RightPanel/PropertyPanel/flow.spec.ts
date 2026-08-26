import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';

import {
  YGPT_ABSOLUTE,
  YGPT_RELATIVE,
  YGU_POINT,
  YGU_UNDEFINED,
} from '../../../../lib/sdk/ui-transform-constants';
import { applyEdits } from '../../code/emit-adapter';
import { codeToUINodes } from '../../code/parse-adapter';
import { uiTransformPatchEdits } from '../../code/transform-patch';
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
      expect(flowPatch('row', 'row')).toBeNull();
      expect(flowPatch('absolute', 'absolute')).toBeNull();
    });

    it('should NOT write flexDirection when picking absolute', () => {
      const patch = flowPatch('absolute', 'column')!;
      expect(patch).not.toHaveProperty('flexDirection');
      expect(patch.positionType).toBe(YGPT_ABSOLUTE);
    });

    it('should anchor to the leading edges rather than bake an offset', () => {
      expect(absolutePatch()).toMatchObject({
        positionTop: 0,
        positionTopUnit: YGU_POINT,
        positionLeft: 0,
        positionLeftUnit: YGU_POINT,
      });
    });

    it('should clear the margins so the pin sits flush', () => {
      expect(absolutePatch()).toMatchObject({
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

    it('should build the absolute cell from the shared patch', () => {
      expect(flowPatch('absolute', 'column')).toEqual(absolutePatch());
    });

    it('should reset the pinned offsets only when leaving absolute', () => {
      const leaving = flowPatch('row', 'absolute')!;
      expect(leaving.positionType).toBe(YGPT_RELATIVE);
      expect(leaving.flexDirection).toBe(FLOW_DIRECTIONS.row);

      const staying = flowPatch('column', 'row')!;
      expect(staying).toEqual({ flexDirection: FLOW_DIRECTIONS.column });
    });
  });

  describe('when toggling wrap', () => {
    it('should read any non-zero flexWrap as wrapping', () => {
      expect(isWrapping({})).toBe(false);
      expect(isWrapping({ flexWrap: 0 })).toBe(false);
      expect(isWrapping({ flexWrap: 1 })).toBe(true);
      expect(isWrapping({ flexWrap: 2 })).toBe(true);
    });

    it('should write only flexWrap', () => {
      expect(wrapPatch(true)).toEqual({ flexWrap: 1 });
      expect(wrapPatch(false)).toEqual({ flexWrap: 0 });
    });
  });

  describe('when a column container is switched to absolute in source', () => {
    const SOURCE = `export function S() {
  return <UiEntity uiTransform={{ width: 100, height: 50, flexDirection: 'column' }} />
}`;

    it('should keep flexDirection in the file', () => {
      const before = transformOf(SOURCE);
      expect(flowValue(before)).toBe('column');

      const next = patchRoot(SOURCE, flowPatch('absolute', 'column')!);
      expect(next).toContain("flexDirection: 'column'");

      const after = transformOf(next);
      expect(after.flexDirection).toBe(FLOW_DIRECTIONS.column);
      expect(after.positionType).toBe(YGPT_ABSOLUTE);
      expect(after.positionTop).toBe(0);
      expect(after.positionTopUnit).toBe(YGU_POINT);
      expect(after.positionLeft).toBe(0);
    });

    it('should show absolute selected, enable Anchor/Position, and check the flow checkbox', () => {
      const after = transformOf(patchRoot(SOURCE, flowPatch('absolute', 'column')!));

      expect(flowValue(after)).toBe('absolute');
      expect(gatedField('Constraints').disabledWhen?.(after)).toBe(false);
      expect(gatedField('Position').disabledWhen?.(after)).toBe(false);
      expect(after.positionType).toBe(YGPT_ABSOLUTE);
    });

    it('should clear a centered anchor counter-margin when leaving absolute', () => {
      const centered = {
        positionType: YGPT_ABSOLUTE,
        positionLeft: 50,
        positionLeftUnit: 2,
        marginLeft: -40,
        marginLeftUnit: YGU_POINT,
      };
      const patch = flowPatch('row', 'absolute', centered)!;
      expect(patch.marginLeft).toBe(0);
      expect(patch.marginLeftUnit).toBe(YGU_UNDEFINED);
      expect(flowPatch('row', 'absolute', { positionType: YGPT_ABSOLUTE })!).not.toHaveProperty(
        'marginLeft',
      );
    });

    it('should restore the hidden direction when switched back in flow', () => {
      const absolute = patchRoot(SOURCE, flowPatch('absolute', 'column')!);
      const backInFlow = patchRoot(absolute, flowPatch('column', 'absolute')!);

      const after = transformOf(backInFlow);
      expect(flowValue(after)).toBe('column');
      expect(after.positionTop).toBeUndefined();
      expect(after.positionLeft).toBeUndefined();
      expect(backInFlow).not.toContain('position:');
    });
  });

  describe('when a node with margins is switched to absolute in source', () => {
    const SOURCE = `export function S() {
  return <UiEntity uiTransform={{ width: 100, height: 50, margin: { top: 32, left: 8 } }} />
}`;

    it('should drop the margins so the pin sits flush against the parent', () => {
      expect(transformOf(SOURCE).marginTop).toBe(32);

      const next = patchRoot(SOURCE, flowPatch('absolute', 'row')!);
      expect(next).not.toContain('margin');

      const after = transformOf(next);
      expect(after.positionTop).toBe(0);
      expect(after.positionLeft).toBe(0);
      expect(after.marginTop).toBeUndefined();
      expect(after.marginLeft).toBeUndefined();
    });
  });
});
