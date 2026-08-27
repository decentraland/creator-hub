import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';

import { generateRootComponent } from './aggregator';
import {
  applyEdits,
  emitElement,
  ensureNamedImport,
  insertChild,
  insertSibling,
  removeAttribute,
  removeNodes,
  removeReturnJsx,
  setAttribute,
  setAttributeExpr,
  setAttributeSegments,
  setObjectField,
  setObjectFields,
  setReturnJsx,
} from './emit-adapter';
import { codeToUINodes, findComponentFn } from './parse-adapter';
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

  describe('and inserting a sibling relative to a target element', () => {
    const firstChildAst = (parsed: ReturnType<typeof parse>) =>
      parsed.astNodes.get(parsed.root.children[0].entity as unknown as number) as any;

    it('inserts a new element BEFORE the target sibling', () => {
      const parsed = parse(SOURCE);
      const edits = insertSibling(
        firstChildAst(parsed),
        SOURCE,
        '<Button value="B" fontSize={12} />',
        'before',
      );
      const reparsed = parse(applyEdits(SOURCE, edits));
      expect(reparsed.root.children).toHaveLength(2);
      expect(reparsed.root.children[0].type).toBe('Button');
      expect(reparsed.root.children[1].type).toBe('Label');
    });

    it('inserts a new element AFTER the target sibling and reparses cleanly', () => {
      const parsed = parse(SOURCE);
      const edits = insertSibling(
        firstChildAst(parsed),
        SOURCE,
        '<Button value="B" fontSize={12} />',
        'after',
      );
      const next = applyEdits(SOURCE, edits);
      expect(parseSync('S.tsx', next).errors).toHaveLength(0);
      const reparsed = parse(next);
      expect(reparsed.root.children).toHaveLength(2);
      expect(reparsed.root.children[0].type).toBe('Label');
      expect(reparsed.root.children[1].type).toBe('Button');
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

  describe('and writing mixed-content segments / removing an attribute', () => {
    const LABEL = `export function S() {
  return <Label value="Hi" />
}`;

    it('should collapse an all-literal segment list to a plain string attribute', () => {
      const parsed = parse(LABEL);
      const next = applyEdits(
        LABEL,
        setAttributeSegments(rootAst(parsed), 'value', [{ kind: 'literal', value: 'Bye' }]),
      );
      expect(next).toContain('value="Bye"');
    });

    it('should collapse a single binding to a bare expression', () => {
      const parsed = parse(LABEL);
      const next = applyEdits(
        LABEL,
        setAttributeSegments(rootAst(parsed), 'value', [{ kind: 'binding', value: 'state.score' }]),
      );
      expect(next).toContain('value={state.score}');
    });

    it('should emit a template literal for mixed literal + binding segments', () => {
      const parsed = parse(LABEL);
      const next = applyEdits(
        LABEL,
        setAttributeSegments(rootAst(parsed), 'value', [
          { kind: 'literal', value: 'Score: ' },
          { kind: 'binding', value: 'state.score' },
        ]),
      );
      expect(next).toContain('value={`Score: ${state.score}`}');
      // Round-trips: the reparse recovers the segments.
      const reparsed = parse(next);
      expect(reparsed.root.bindings?.[0].segments).toEqual([
        { kind: 'literal', value: 'Score: ' },
        { kind: 'binding', value: 'state.score' },
      ]);
    });

    it('should remove an attribute entirely (unbind), absorbing one leading space', () => {
      const parsed = parse(LABEL);
      const next = applyEdits(LABEL, removeAttribute(rootAst(parsed), LABEL, 'value'));
      expect(next).toContain('<Label />');
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

describe('ensureNamedImport', () => {
  function prog(source: string) {
    const r = parseSync('S.tsx', source);
    expect(r.errors).toHaveLength(0);
    return r.program as any;
  }

  it('adds a fresh import line after the existing imports', () => {
    const src =
      "import ReactEcs from '@dcl/sdk/react-ecs'\n\nexport function S() { return <UiEntity /> }";
    const next = applyEdits(src, ensureNamedImport(prog(src), 'OtroNombre', './OtroNombre'));
    expect(next).toContain("import { OtroNombre } from './OtroNombre'");
    expect(parseSync('S.tsx', next).errors).toHaveLength(0);
  });

  it('is a no-op when the name is already imported from that module', () => {
    const src =
      "import { OtroNombre } from './OtroNombre'\nexport function S() { return <OtroNombre /> }";
    expect(ensureNamedImport(prog(src), 'OtroNombre', './OtroNombre')).toEqual([]);
  });

  it('appends to an existing named import from the same module', () => {
    const src = "import { A } from './lib'\nexport function S() { return <A /> }";
    const next = applyEdits(src, ensureNamedImport(prog(src), 'B', './lib'));
    expect(next).toContain("import { A, B } from './lib'");
    expect(parseSync('S.tsx', next).errors).toHaveLength(0);
  });

  // A generated root opens with a DEFAULT-only import of the very module the
  // widget imports come from, so the module is spread over several statements.
  // Judging it by the first statement alone made every add emit a fresh line,
  // duplicating the binding (TS2300) as soon as a second node of a kind landed.
  describe('when the module is already imported by a default-only statement', () => {
    const ECS = '@dcl/sdk/react-ecs';

    function addNames(source: string, names: string[]) {
      return names.reduce(
        (src, name) => applyEdits(src, ensureNamedImport(prog(src), name, ECS)),
        source,
      );
    }

    it('imports each name exactly once no matter how often it is added', () => {
      // The real generator output, so this fixture cannot drift from it.
      const src = generateRootComponent('MainUI');
      expect(src).toContain(`import ReactEcs from '${ECS}'`);

      const next = addNames(src, ['UiEntity', 'Label', 'UiEntity', 'Label', 'Button']);

      for (const name of ['UiEntity', 'Label', 'Button']) {
        expect(
          next.match(new RegExp(`\\b${name}\\b(?=[^\\n]*from '@dcl/sdk/react-ecs')`, 'g')),
        ).toHaveLength(1);
      }
      expect(parseSync('S.tsx', next).errors).toHaveLength(0);
    });

    it('leaves the default import statement untouched', () => {
      const src = generateRootComponent('MainUI');
      const next = addNames(src, ['UiEntity', 'UiEntity']);
      expect(next).toContain(`import ReactEcs from '${ECS}'`);
      expect(next.match(/import ReactEcs from/g)).toHaveLength(1);
    });

    // The shape the file is in after the FIRST add: the default statement no
    // longer holds the only clue about what the module already provides.
    describe('and a later statement carries the named group', () => {
      const src = [
        `import ReactEcs from '${ECS}'`,
        `import { UiEntity } from '${ECS}'`,
        'export function S() { return <UiEntity /> }',
      ].join('\n');

      it('is a no-op for a name that later statement already imports', () => {
        expect(ensureNamedImport(prog(src), 'UiEntity', ECS)).toEqual([]);
      });

      it('appends a new name to that group instead of opening another line', () => {
        const next = applyEdits(src, ensureNamedImport(prog(src), 'Label', ECS));
        expect(next).toContain(`import { UiEntity, Label } from '${ECS}'`);
        expect(next.match(new RegExp(`from '${ECS}'`, 'g'))).toHaveLength(2);
        expect(parseSync('S.tsx', next).errors).toHaveLength(0);
      });
    });

    it('is a no-op for a name the mixed default+named form already imports', () => {
      const src = `import ReactEcs, { UiEntity } from '${ECS}'\nexport function S() { return <UiEntity /> }`;
      expect(ensureNamedImport(prog(src), 'UiEntity', ECS)).toEqual([]);
    });
  });
});

describe('when setting multiple object fields in one call (setObjectFields)', () => {
  const parseEl = (src: string) => {
    const parsed = parse(src);
    return {
      src,
      el: parsed.astNodes.get(parsed.root.entity as unknown as number) as any,
    };
  };

  it('composes into ONE attribute when uiTransform is absent (no duplicate attr)', () => {
    const { src, el } = parseEl('export function S() { return <UiEntity /> }');
    const next = applyEdits(src, setObjectFields(el, 'uiTransform', { width: 50, height: 100 }));
    expect(next.match(/uiTransform/g)).toHaveLength(1);
    const reparsed = parse(next);
    expect(reparsed.root.uiTransform).toMatchObject({ width: 50, height: 100 });
  });

  it('composes with a separating comma when uiTransform is an empty object', () => {
    const { src, el } = parseEl('export function S() { return <UiEntity uiTransform={{}} /> }');
    const next = applyEdits(src, setObjectFields(el, 'uiTransform', { width: 50, height: 100 }));
    expect(parseSync('S.tsx', next).errors).toHaveLength(0);
    expect(parse(next).root.uiTransform).toMatchObject({ width: 50, height: 100 });
  });

  it('removes a field when its value is undefined, absorbing the comma', () => {
    const { src, el } = parseEl(
      'export function S() { return <UiEntity uiTransform={{ width: 50, height: 100, flexGrow: 1 }} /> }',
    );
    const next = applyEdits(src, setObjectFields(el, 'uiTransform', { height: undefined }));
    expect(next).not.toContain('height');
    expect(next).toContain('width: 50');
    expect(next).toContain('flexGrow: 1');
    expect(parseSync('S.tsx', next).errors).toHaveLength(0);
  });

  it('removes ADJACENT fields without overlapping edits', () => {
    const { src, el } = parseEl(
      'export function S() { return <UiEntity uiTransform={{ width: 50, height: 100, flexGrow: 1 }} /> }',
    );
    const next = applyEdits(
      src,
      setObjectFields(el, 'uiTransform', { width: undefined, height: undefined }),
    );
    expect(next).not.toContain('width');
    expect(next).not.toContain('height');
    expect(next).toContain('flexGrow: 1');
    expect(parseSync('S.tsx', next).errors).toHaveLength(0);
  });

  it('replaces, inserts and removes in one call', () => {
    const { src, el } = parseEl(
      'export function S() { return <UiEntity uiTransform={{ width: 50, height: 100 }} /> }',
    );
    const next = applyEdits(
      src,
      setObjectFields(el, 'uiTransform', { width: 75, height: undefined, flexGrow: 1 }),
    );
    expect(parse(next).root.uiTransform).toMatchObject({ width: 75, flexGrow: 1 });
    expect(next).not.toContain('height');
  });
});

describe('when a string attribute needs escape sequences', () => {
  const label = (src: string) => {
    const parsed = parse(src);
    const node = parsed.root.children[0];
    return { parsed, el: parsed.astNodes.get(node.entity as unknown as number) as any };
  };
  const SRC = 'export function S() { return <UiEntity><Label value="Hi" /></UiEntity> }';

  it('emits a double quote via the braces form (plain JSX attr strings cannot escape)', () => {
    const { el } = label(SRC);
    const next = applyEdits(SRC, setAttribute(el, 'value', 'say "hi"'));
    expect(parseSync('S.tsx', next).errors).toHaveLength(0);
    const reparsed = parse(next);
    expect((reparsed.root.children[0].uiText as Record<string, unknown>).value).toBe('say "hi"');
  });

  it('round-trips a newline as a real newline, not a literal backslash-n', () => {
    const { el } = label(SRC);
    const next = applyEdits(SRC, setAttribute(el, 'value', 'line1\nline2'));
    expect(parseSync('S.tsx', next).errors).toHaveLength(0);
    const reparsed = parse(next);
    expect((reparsed.root.children[0].uiText as Record<string, unknown>).value).toBe(
      'line1\nline2',
    );
  });

  it('keeps the plain ="…" form for escape-free strings', () => {
    const { el } = label(SRC);
    const next = applyEdits(SRC, setAttribute(el, 'value', 'plain text'));
    expect(next).toContain('value="plain text"');
  });
});

describe('setReturnJsx (place the first element into a component body)', () => {
  const fnOf = (source: string) => {
    const r = parseSync('S.tsx', source);
    expect(r.errors).toHaveLength(0);
    return findComponentFn(r.program as any, 'S') as any;
  };

  it('inserts the argument after a bare `return` (empty root → first element)', () => {
    const src = 'export function S() {\n  return\n}';
    const next = applyEdits(src, setReturnJsx(fnOf(src), src, '<UiEntity />'));
    expect(parseSync('S.tsx', next).errors).toHaveLength(0);
    expect(parse(next).root.type).toBe('UiEntity');
  });

  it('replaces a `return null` with the element', () => {
    const src = 'export function S() {\n  return null\n}';
    const next = applyEdits(
      src,
      setReturnJsx(fnOf(src), src, '<Label value="Hi" fontSize={12} />'),
    );
    expect(next).not.toContain('null');
    expect(parse(next).root.type).toBe('Label');
  });

  it('replaces an existing returned element', () => {
    const src = 'export function S() {\n  return (\n    <UiEntity />\n  )\n}';
    const next = applyEdits(
      src,
      setReturnJsx(fnOf(src), src, '<Label value="Hi" fontSize={12} />'),
    );
    expect(parse(next).root.type).toBe('Label');
  });

  it('inserts a return when the body has none', () => {
    const src = 'export function S() {\n}';
    const next = applyEdits(src, setReturnJsx(fnOf(src), src, '<UiEntity />'));
    expect(parseSync('S.tsx', next).errors).toHaveLength(0);
    expect(parse(next).root.type).toBe('UiEntity');
  });
});

describe('removeReturnJsx (delete the returned root, leaving an empty GUI)', () => {
  const fnOf = (source: string) => {
    const r = parseSync('S.tsx', source);
    expect(r.errors).toHaveLength(0);
    return findComponentFn(r.program as any, 'S') as any;
  };

  describe('when the body returns a wrapped element', () => {
    const src =
      'export const state = { n: 0 }\n' +
      'export function S() {\n  return (\n    <UiEntity uiTransform={{ width: 100 }} />\n  )\n}';

    it('should strip the argument down to a bare return and keep the rest of the file', () => {
      const next = applyEdits(src, removeReturnJsx(fnOf(src)));
      expect(parseSync('S.tsx', next).errors).toHaveLength(0);
      expect(next).toContain('export const state = { n: 0 }');
      expect(next).toMatch(/return\s*\n\s*}/);
      // The destination state: no root JSX means codeToUINodes yields no tree.
      expect(codeToUINodes(parseSync('S.tsx', next).program as any, next)).toBeNull();
    });
  });

  describe('when the body already has a bare return', () => {
    it('should emit no edits', () => {
      const src = 'export function S() {\n  return\n}';
      expect(removeReturnJsx(fnOf(src))).toEqual([]);
    });
  });

  describe('when the component is a concise arrow with no block body', () => {
    it('should emit no edits', () => {
      const src = 'export const S = () => <UiEntity />';
      expect(removeReturnJsx(fnOf(src))).toEqual([]);
    });
  });
});

describe('removeNodes (multi-node removal in one edit batch)', () => {
  const SRC = `export function S() {
  return (
    <UiEntity uiTransform={{ width: 400 }}>
      <Label value="a" />
      <UiEntity uiTransform={{ width: 100 }}>
        <Label value="nested" />
      </UiEntity>
      <Button value="b" />
    </UiEntity>
  )
}`;
  const astsOf = (parsed: ReturnType<typeof parse>, nodes: CodeUINode[]) =>
    nodes.map(n => parsed.astNodes.get(n.entity as unknown as number) as any);

  describe('when removing two independent siblings', () => {
    it('should delete both spans in one applyEdits pass', () => {
      const parsed = parse(SRC);
      const [labelA, , button] = parsed.root.children;
      const next = applyEdits(SRC, removeNodes(astsOf(parsed, [labelA, button])));
      expect(parseSync('S.tsx', next).errors).toHaveLength(0);
      const reparsed = parse(next);
      expect(reparsed.root.children).toHaveLength(1);
      expect(reparsed.root.children[0].children[0].type).toBe('Label');
    });
  });

  describe('when the selection contains a node and its own descendant', () => {
    it('should drop the descendant edit and remove the ancestor once', () => {
      const parsed = parse(SRC);
      const container = parsed.root.children[1];
      const nested = container.children[0];
      const edits = removeNodes(astsOf(parsed, [nested, container]));
      expect(edits).toHaveLength(1);
      const next = applyEdits(SRC, edits);
      expect(next).not.toContain('nested');
      expect(parseSync('S.tsx', next).errors).toHaveLength(0);
    });
  });

  describe('when the list is empty', () => {
    it('should emit no edits', () => {
      expect(removeNodes([])).toEqual([]);
    });
  });
});
