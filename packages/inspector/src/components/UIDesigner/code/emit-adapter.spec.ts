import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';

import {
  applyEdits,
  emitElement,
  insertChild,
  setAttribute,
  setAttributeExpr,
  setObjectField,
} from './emit-adapter';
import { codeToUINodes } from './parse-adapter';
import type { CodeUINode } from './types';

function parse(source: string) {
  const r = parseSync('S.tsx', source);
  expect(r.errors).toHaveLength(0);
  const parsed = codeToUINodes(r.program as any, source)!;
  expect(parsed).not.toBeNull();
  return parsed;
}

const SOURCE = `export function S() {
  return (
    <UiEntity uiTransform={{ width: 400, height: 200 }}>
      <Label value="Hi" fontSize={12} />
    </UiEntity>
  )
}`;

describe('when splicing visual edits back into the source', () => {
  const rootAst = (parsed: ReturnType<typeof parse>) =>
    parsed.astNodes.get(parsed.root.entity as unknown as number) as any;

  describe('and changing an existing object-literal field (uiTransform.width)', () => {
    it('should replace only that value and leave everything else byte-identical', () => {
      const parsed = parse(SOURCE);
      const edits = setObjectField(rootAst(parsed), 'uiTransform', 'width', 999);
      const next = applyEdits(SOURCE, edits);

      // The reparsed tree reflects the change...
      const reparsed = parse(next);
      expect((reparsed.root.uiTransform as Record<string, number>).width).toBe(999);

      // ...and the untouched regions are preserved verbatim.
      expect(next).toContain('height: 200');
      expect(next).toContain('<Label value="Hi" fontSize={12} />');
      // Only "400" → "999" changed; the rest of the string is identical.
      expect(next).toBe(SOURCE.replace('width: 400', 'width: 999'));
    });
  });

  describe('and adding a field that is missing from the object', () => {
    it('should insert it while preserving the existing fields', () => {
      const parsed = parse(SOURCE);
      const edits = setObjectField(rootAst(parsed), 'uiTransform', 'display', 'flex');
      const next = applyEdits(SOURCE, edits);
      // The field is inserted into the source object literal...
      expect(next).toContain('display: "flex"');
      // ...and the existing fields are preserved.
      const reparsed = parse(next);
      expect((reparsed.root.uiTransform as Record<string, number>).width).toBe(400);
      expect((reparsed.root.uiTransform as Record<string, number>).height).toBe(200);
    });
  });

  describe('and setting a prop whose attribute is absent', () => {
    it('should add the attribute with the object literal', () => {
      const parsed = parse(SOURCE);
      const edits = setObjectField(rootAst(parsed), 'uiBackground', 'color', 'red');
      const reparsed = parse(applyEdits(SOURCE, edits));
      expect(reparsed.root.uiBackground).toEqual({ color: 'red' });
      // uiTransform untouched.
      expect((reparsed.root.uiTransform as Record<string, number>).width).toBe(400);
    });
  });

  describe('and inserting a new child element', () => {
    it('should add it before the closing tag and reparse with one more child', () => {
      const parsed = parse(SOURCE);
      const childJsx = emitElement({ type: 'UiEntity', uiTransform: { width: 10, height: 10 } });
      const edits = insertChild(rootAst(parsed), SOURCE, childJsx);
      const reparsed = parse(applyEdits(SOURCE, edits));

      expect(reparsed.root.children).toHaveLength(2);
      const added = reparsed.root.children[1] as CodeUINode;
      expect(added.type).toBe('UiEntity');
      expect((added.uiTransform as Record<string, number>).width).toBe(10);
      // The pre-existing Label is untouched.
      expect(reparsed.root.children[0].type).toBe('Label');
    });
  });

  describe('and emitting a Label element', () => {
    it('should produce JSX that parses back to the same node', () => {
      const jsx = emitElement({ type: 'Label', uiText: { value: 'Score', fontSize: 24 } });
      const reparsed = parse(`export function S() { return ${jsx} }`);
      expect(reparsed.root.type).toBe('Label');
      expect(reparsed.root.uiText).toEqual({ value: 'Score', fontSize: 24 });
    });
  });

  describe('and setting a top-level attribute (Label props)', () => {
    const LABEL = `export function S() {
  return <Label value="Hi" />
}`;

    it('should replace an existing string attribute in place', () => {
      const parsed = parse(LABEL);
      const next = applyEdits(LABEL, setAttribute(rootAst(parsed), 'value', 'Bye'));
      expect(next).toContain('value="Bye"');
      expect(parse(next).root.uiText).toEqual({ value: 'Bye' });
    });

    it('should add a missing numeric attribute', () => {
      const parsed = parse(LABEL);
      const next = applyEdits(LABEL, setAttribute(rootAst(parsed), 'fontSize', 24));
      expect(next).toContain('fontSize={24}');
      expect((parse(next).root.uiText as Record<string, number>).fontSize).toBe(24);
    });

    it('should bind an attribute to a raw expression (variable reference)', () => {
      const parsed = parse(LABEL);
      const next = applyEdits(LABEL, setAttributeExpr(rootAst(parsed), 'value', 'score'));
      // Unquoted expression, not a string literal.
      expect(next).toContain('value={score}');
      expect(next).not.toContain('value="score"');
    });
  });

  describe('applyEdits guardrails', () => {
    it('should reject overlapping edits', () => {
      expect(() =>
        applyEdits('abcdef', [
          { start: 0, end: 3, text: 'x' },
          { start: 2, end: 5, text: 'y' },
        ]),
      ).toThrow(/overlapping/);
    });
  });
});
