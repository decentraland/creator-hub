import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';

import { applyEdits } from './emit-adapter';
import {
  nodeNameEdit,
  readNodeName,
  renumberNodeNames,
  sanitizeNodeName,
  withNodeName,
} from './name-marker';

// Every JSXElement in source order, so a test can address "the first element"
// (the outer one) or "the second" (its child).
function elements(source: string): any[] {
  const r = parseSync('S.tsx', source);
  expect(r.errors).toHaveLength(0);
  const out: any[] = [];
  const walk = (n: any) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (n.type === 'JSXElement') out.push(n);
    for (const k of Object.keys(n)) if (k !== 'type') walk(n[k]);
  };
  walk(r.program);
  return out.sort((a, b) => a.start - b.start);
}

describe('when sanitizing a node name', () => {
  it('should strip comment delimiters and collapse whitespace', () => {
    expect(sanitizeNodeName('  My   Panel ')).toBe('My Panel');
    expect(sanitizeNodeName('Pan*/el')).toBe('Pan el');
    expect(sanitizeNodeName('a\nb\tc')).toBe('a b c');
  });

  it('should return an empty string for a name with nothing left', () => {
    expect(sanitizeNodeName('***')).toBe('');
    expect(sanitizeNodeName('')).toBe('');
  });
});

describe('when reading a node name marker', () => {
  it('should read the marker from the opening tag', () => {
    const src = 'const a = <UiEntity /* @ui-name Sidebar */ uiTransform={{ width: 1 }} />';
    expect(readNodeName(src, elements(src)[0])).toBe('Sidebar');
  });

  it('should accept a name with spaces', () => {
    const src = 'const a = <UiEntity /* @ui-name My Panel */ />';
    expect(readNodeName(src, elements(src)[0])).toBe('My Panel');
  });

  it('should return undefined when there is no marker', () => {
    const src = 'const a = <UiEntity uiTransform={{ width: 1 }} />';
    expect(readNodeName(src, elements(src)[0])).toBeUndefined();
  });

  it("should not read a child's marker as the parent's, being scoped to the opening tag", () => {
    const src = `const a = (
      <UiEntity>
        <Label /* @ui-name Title */ value="x" />
      </UiEntity>
    )`;
    const [outer, inner] = elements(src);
    expect(readNodeName(src, outer)).toBeUndefined();
    expect(readNodeName(src, inner)).toBe('Title');
  });
});

describe('when writing a node name marker', () => {
  it('should insert a marker right after the tag name', () => {
    const src = 'const a = <UiEntity uiTransform={{ width: 1 }} />';
    const next = applyEdits(src, nodeNameEdit(elements(src)[0], src, 'Sidebar'));
    expect(next).toBe('const a = <UiEntity /* @ui-name Sidebar */ uiTransform={{ width: 1 }} />');
    expect(parseSync('S.tsx', next).errors).toHaveLength(0);
  });

  it('should replace an existing marker in place', () => {
    const src = 'const a = <UiEntity /* @ui-name Old */ uiTransform={{ width: 1 }} />';
    const next = applyEdits(src, nodeNameEdit(elements(src)[0], src, 'New'));
    expect(next).toBe('const a = <UiEntity /* @ui-name New */ uiTransform={{ width: 1 }} />');
  });

  it('should be idempotent when the name already matches', () => {
    const src = 'const a = <UiEntity /* @ui-name Same */ />';
    expect(nodeNameEdit(elements(src)[0], src, 'Same')).toEqual([]);
  });

  it('should remove the marker when the name is emptied', () => {
    const src = 'const a = <UiEntity /* @ui-name Old */ uiTransform={{ width: 1 }} />';
    const next = applyEdits(src, nodeNameEdit(elements(src)[0], src, '   '));
    expect(next).toBe('const a = <UiEntity uiTransform={{ width: 1 }} />');
  });

  it('should not let a name break out of the comment', () => {
    const src = 'const a = <UiEntity />';
    const next = applyEdits(src, nodeNameEdit(elements(src)[0], src, 'evil */ onMouseDown={x}'));
    expect(next).toBe('const a = <UiEntity /* @ui-name evil onMouseDown={x} */ />');
    expect(parseSync('S.tsx', next).errors).toHaveLength(0);
  });

  it('should leave a self-closing tag with no attributes parseable', () => {
    const src = 'const a = <Label />';
    const next = applyEdits(src, nodeNameEdit(elements(src)[0], src, 'Title'));
    expect(next).toBe('const a = <Label /* @ui-name Title */ />');
    expect(parseSync('S.tsx', next).errors).toHaveLength(0);
  });
});

describe('when seeding a generated element with a name', () => {
  it('should place the marker after the tag name, whatever follows', () => {
    expect(withNodeName('<Label value="Label" fontSize={24} />', 'Title')).toBe(
      '<Label /* @ui-name Title */ value="Label" fontSize={24} />',
    );
    expect(withNodeName('<UiEntity />', 'Container')).toBe('<UiEntity /* @ui-name Container */ />');
  });

  it('should produce parseable JSX for every widget template', () => {
    for (const jsx of [
      '<UiEntity uiTransform={{ width: 200 }} />',
      '<Label value="Label" fontSize={24} />',
      '<Button value="Button" fontSize={18} />',
      '<Input placeholder="Type here" fontSize={18} />',
      "<Dropdown options={['Option 1', 'Option 2']} fontSize={18} />",
    ]) {
      const named = withNodeName(jsx, 'Widget');
      const el = elements(`const a = ${named}`)[0];
      expect(readNodeName(`const a = ${named}`, el)).toBe('Widget');
    }
  });
});

describe('when renumbering the names in a duplicated subtree', () => {
  it('should give every marker in the copy a free name', () => {
    const raw = `<UiEntity /* @ui-name Panel */>
  <Label /* @ui-name Title */ value="x" />
</UiEntity>`;
    expect(renumberNodeNames(raw, ['Panel', 'Title'])).toBe(`<UiEntity /* @ui-name Panel1 */>
  <Label /* @ui-name Title1 */ value="x" />
</UiEntity>`);
  });

  it('should number from the base name, so a copy of Panel1 is Panel2 and not Panel11', () => {
    const raw = '<UiEntity /* @ui-name Panel1 */ />';
    expect(renumberNodeNames(raw, ['Panel', 'Panel1'])).toBe('<UiEntity /* @ui-name Panel2 */ />');
  });

  it('should not collide within the copy itself', () => {
    const raw = `<UiEntity /* @ui-name Row */>
  <UiEntity /* @ui-name Row1 */ />
</UiEntity>`;
    expect(renumberNodeNames(raw, ['Row', 'Row1'])).toBe(`<UiEntity /* @ui-name Row2 */>
  <UiEntity /* @ui-name Row3 */ />
</UiEntity>`);
  });

  it('should leave a copy with no markers untouched', () => {
    const raw = '<UiEntity uiTransform={{ width: 1 }} />';
    expect(renumberNodeNames(raw, ['Panel'])).toBe(raw);
  });
});
