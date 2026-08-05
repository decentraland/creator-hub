import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';

import { applyEdits } from './emit-adapter';
import { codeToUINodes } from './parse-adapter';
import { flattenedToErgonomicKey, uiTransformPatchEdits } from './transform-patch';

function parse(source: string) {
  const r = parseSync('S.tsx', source);
  expect(r.errors).toHaveLength(0);
  const parsed = codeToUINodes(r.program as any, source)!;
  expect(parsed).not.toBeNull();
  return parsed;
}

function rootAst(parsed: ReturnType<typeof parse>) {
  return parsed.astNodes.get(parsed.root.entity as unknown as number) as any;
}

function patchRoot(source: string, patch: Record<string, unknown>): string {
  const parsed = parse(source);
  const current = (parsed.root.uiTransform as Record<string, unknown>) ?? {};
  const edits = uiTransformPatchEdits(rootAst(parsed), current, patch);
  return applyEdits(source, edits);
}

const YGU_POINT = 1;

describe('flattenedToErgonomicKey', () => {
  it('should map flattened PB keys to their ergonomic uiTransform key', () => {
    expect(flattenedToErgonomicKey('width')).toBe('width');
    expect(flattenedToErgonomicKey('widthUnit')).toBe('width');
    expect(flattenedToErgonomicKey('positionType')).toBe('positionType');
    expect(flattenedToErgonomicKey('positionTop')).toBe('position');
    expect(flattenedToErgonomicKey('marginLeftUnit')).toBe('margin');
    expect(flattenedToErgonomicKey('paddingBottom')).toBe('padding');
    expect(flattenedToErgonomicKey('borderTopLeftRadius')).toBe('borderRadius');
    expect(flattenedToErgonomicKey('borderTopLeftRadiusUnit')).toBe('borderRadius');
    expect(flattenedToErgonomicKey('borderRightWidth')).toBe('borderWidth');
    expect(flattenedToErgonomicKey('borderBottomColor')).toBe('borderColor');
    expect(flattenedToErgonomicKey('opacity')).toBe('opacity');
    expect(flattenedToErgonomicKey('parent')).toBeNull();
  });
});

describe('when patching a uiTransform field from the panel', () => {
  describe('and the source object carries props the editor does not model', () => {
    // The P0 regression: the previous whole-attribute re-emit erased any
    // key outside the modeled table (e.g. react-ecs's `flex` shorthand).
    const SOURCE = `export function S() {
  return <UiEntity uiTransform={{ width: 100, flex: 1, height: 50 }} />
}`;

    it('should splice only the patched field and leave the unmodeled prop intact', () => {
      const next = patchRoot(SOURCE, { width: 200, widthUnit: YGU_POINT });
      expect(next).toContain('flex: 1');
      expect(next).toContain('width: 200');
      expect(next).toBe(SOURCE.replace('width: 100', 'width: 200'));
    });
  });

  describe('and setting an Effects field (opacity / zIndex)', () => {
    const SOURCE = `export function S() {
  return <UiEntity uiTransform={{ width: 100 }} />
}`;

    it('should write opacity into the source object', () => {
      const next = patchRoot(SOURCE, { opacity: 0.5 });
      expect(next).toContain('opacity: 0.5');
      expect(next).toContain('width: 100');
      expect(parse(next).root.uiTransform).toMatchObject({ opacity: 0.5 });
    });

    it('should write zIndex into the source object', () => {
      const next = patchRoot(SOURCE, { zIndex: 3 });
      expect(next).toContain('zIndex: 3');
      expect(parse(next).root.uiTransform).toMatchObject({ zIndex: 3 });
    });
  });

  describe('and setting a uniform border radius from the panel writeAll patch', () => {
    const SOURCE = `export function S() {
  return <UiEntity uiTransform={{ width: 100 }} />
}`;

    it('should fold the four corners into a single borderRadius value', () => {
      const next = patchRoot(SOURCE, {
        borderTopLeftRadius: 8,
        borderTopLeftRadiusUnit: YGU_POINT,
        borderTopRightRadius: 8,
        borderTopRightRadiusUnit: YGU_POINT,
        borderBottomLeftRadius: 8,
        borderBottomLeftRadiusUnit: YGU_POINT,
        borderBottomRightRadius: 8,
        borderBottomRightRadiusUnit: YGU_POINT,
      });
      expect(next).toContain('borderRadius: 8');
      expect(parse(next).root.uiTransform).toMatchObject({
        borderTopLeftRadius: 8,
        borderBottomRightRadius: 8,
      });
    });
  });

  describe('and switching a node back to in-flow (position-mode patch)', () => {
    const SOURCE = `export function S() {
  return <UiEntity uiTransform={{ width: 100, positionType: 'absolute', position: { top: 10, left: 20 } }} />
}`;

    it('should remove positionType and the cleared position edges from source', () => {
      // The panel's position-mode write: relative + zeroed edges with
      // undefined units (unset).
      const next = patchRoot(SOURCE, {
        positionType: 0,
        positionTop: 0,
        positionTopUnit: undefined,
        positionLeft: 0,
        positionLeftUnit: undefined,
        positionRight: 0,
        positionRightUnit: undefined,
        positionBottom: 0,
        positionBottomUnit: undefined,
      });
      expect(next).not.toContain('positionType');
      expect(next).not.toContain('position:');
      expect(next).toContain('width: 100');
    });
  });

  // The panel header's eye. Hiding writes the enum; showing REMOVES the prop
  // rather than writing 'flex', so toggling twice must leave the source as it was.
  describe('and toggling the header eye (display patch)', () => {
    const SOURCE = `export function S() {
  return <UiEntity uiTransform={{ width: 100 }} />
}`;

    // Quote style is the emitter's (the store re-formats with Prettier after the
    // splice), so the assertion is on the parsed value, not on the spelling.
    it('should write display none and read it back', () => {
      const hidden = patchRoot(SOURCE, { display: 1 });
      expect(hidden).toMatch(/display: ['"]none['"]/);
      expect(parse(hidden).root.uiTransform).toMatchObject({ display: 1 });
    });

    it('should leave the source byte-identical after hiding and showing again', () => {
      const hidden = patchRoot(SOURCE, { display: 1 });
      expect(patchRoot(hidden, { display: undefined })).toBe(SOURCE);
    });

    it('should clear a hand-authored display: flex when shown', () => {
      const authored = `export function S() {
  return <UiEntity uiTransform={{ width: 100, display: 'flex' }} />
}`;
      expect(parse(authored).root.uiTransform).toMatchObject({ display: 0 });
      expect(patchRoot(authored, { display: undefined })).not.toContain('display');
    });
  });

  // The Resize control's Fill mode is a multi-key patch: it sets the borrowed
  // prop AND removes the axis size in the same splice (resize-modes.resizePatch).
  describe('and switching a Resize axis to Fill and back', () => {
    const SOURCE = `export function S() {
  return <UiEntity uiTransform={{ width: 100, height: 50 }} />
}`;

    it('should write flexGrow and drop the axis size in one patch', () => {
      const filled = patchRoot(SOURCE, { width: undefined, widthUnit: undefined, flexGrow: 1 });
      const t = parse(filled).root.uiTransform as Record<string, unknown>;
      expect(t.flexGrow).toBe(1);
      expect(t.widthUnit).toBeUndefined();
      expect(t).toMatchObject({ height: 50 });
    });

    // Not byte-identical: the axis key is REMOVED and re-added, so it moves to
    // the object's tail. Same parsed transform is the honest invariant.
    it('should restore the same transform after Fill and Fixed again', () => {
      const filled = patchRoot(SOURCE, { width: undefined, widthUnit: undefined, flexGrow: 1 });
      const back = patchRoot(filled, { flexGrow: undefined, width: 100, widthUnit: YGU_POINT });
      expect(parse(back).root.uiTransform).toEqual(parse(SOURCE).root.uiTransform);
    });

    it('should write alignSelf stretch for a cross-axis Fill and read it back', () => {
      const filled = patchRoot(SOURCE, { height: undefined, heightUnit: undefined, alignSelf: 4 });
      const t = parse(filled).root.uiTransform as Record<string, unknown>;
      expect(t.alignSelf).toBe(4);
      expect(t.heightUnit).toBeUndefined();
    });
  });

  // The two derived checkboxes always write the enum explicitly (an absent key
  // means "inherit" inside an override layer — see overflow-flags.overflowPatch).
  describe('and toggling the overflow checkboxes', () => {
    const SOURCE = `export function S() {
  return <UiEntity uiTransform={{ width: 100 }} />
}`;

    it('should round-trip each overflow value through source', () => {
      for (const [value, name] of [
        [2, 'scroll'],
        [1, 'hidden'],
        [0, 'visible'],
      ] as const) {
        const next = patchRoot(SOURCE, { overflow: value });
        expect(next).toMatch(new RegExp(`overflow: ['"]${name}['"]`));
        expect(parse(next).root.uiTransform).toMatchObject({ overflow: value });
      }
    });
  });

  describe('and the node has a partially-dynamic uiTransform', () => {
    it('should flag dynamicProps so write paths refuse the edit', () => {
      const SOURCE = `export function S() {
  return <UiEntity uiTransform={{ width: state.w, height: 100 }} />
}`;
      const parsed = parse(SOURCE);
      expect(parsed.root.dynamicProps).toBe(true);
      // The static field still parses for display.
      expect(parsed.root.uiTransform).toMatchObject({ height: 100 });
    });

    it('should flag dynamicProps for an object spread', () => {
      const SOURCE = `export function S() {
  return <UiEntity uiTransform={{ ...base, width: 100 }} />
}`;
      const parsed = parse(SOURCE);
      expect(parsed.root.dynamicProps).toBe(true);
    });

    it('should flag dynamicProps for a NESTED dynamic value', () => {
      const SOURCE = `export function S() {
  return <UiEntity uiTransform={{ position: { top: state.y }, width: 100 }} />
}`;
      const parsed = parse(SOURCE);
      expect(parsed.root.dynamicProps).toBe(true);
    });
  });

  describe('and parsing react-ecs string shorthand margins', () => {
    it('should expand the shorthand into PB edges', () => {
      const SOURCE = `export function S() {
  return <UiEntity uiTransform={{ margin: '8px 16px' }} />
}`;
      const parsed = parse(SOURCE);
      expect(parsed.root.uiTransform).toMatchObject({
        marginTop: 8,
        marginRight: 16,
        marginBottom: 8,
        marginLeft: 16,
      });
      expect(parsed.root.dynamicProps).toBeUndefined();
    });
  });
});
