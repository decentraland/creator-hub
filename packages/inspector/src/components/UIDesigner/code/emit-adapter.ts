import { keyName, unparen } from './ast-utils';
import type { CodeUINode } from './types';

interface AstNode {
  type: string;
  start: number;
  end: number;
  [k: string]: any;
}

export interface Edit {
  start: number;
  end: number;
  text: string;
}

export function applyEdits(source: string, edits: Edit[]): string {
  const sorted = [...edits].sort((a, b) => b.start - a.start);
  let out = source;
  let prevStart = Infinity;
  for (const e of sorted) {
    if (e.end > prevStart) throw new Error('applyEdits: overlapping edits');
    if (e.start > e.end) throw new Error('applyEdits: inverted edit');
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
    prevStart = e.start;
  }
  return out;
}

function findAttr(el: AstNode, name: string): AstNode | undefined {
  return (el.openingElement?.attributes ?? []).find(
    (a: AstNode) => a.type === 'JSXAttribute' && a.name?.name === name,
  );
}

export class RawExpr {
  constructor(readonly text: string) {}
}

export const raw = (text: string): RawExpr => new RawExpr(text);

function serializeValue(v: unknown): string {
  if (v instanceof RawExpr) return v.text;
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
    return emitObject(v as Record<string, unknown>);
  }
  return JSON.stringify(v);
}

function emitObject(o: Record<string, unknown>): string {
  const parts = Object.entries(o).map(([k, v]) => {
    const val =
      v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof RawExpr)
        ? emitObject(v as Record<string, unknown>)
        : serializeValue(v);
    return `${k}: ${val}`;
  });
  return parts.length ? `{ ${parts.join(', ')} }` : '{}';
}

export function setObjectField(
  el: AstNode,
  attrName: string,
  fieldName: string,
  value: unknown,
): Edit[] {
  return setObjectFields(el, attrName, { [fieldName]: value });
}

export function setObjectFields(
  el: AstNode,
  attrName: string,
  fields: Record<string, unknown>,
): Edit[] {
  const setEntries = Object.entries(fields).filter(([, v]) => v !== undefined);
  const attr = findAttr(el, attrName);

  if (!attr) {
    if (setEntries.length === 0) return [];
    const at = el.openingElement.name.end;
    const body = setEntries.map(([k, v]) => fieldText(k, v)).join(', ');
    return [{ start: at, end: at, text: ` ${attrName}={{ ${body} }}` }];
  }

  const container = attr.value;
  if (!container || container.type !== 'JSXExpressionContainer') {
    const body = setEntries.map(([k, v]) => fieldText(k, v)).join(', ');
    return [{ start: attr.start, end: attr.end, text: `${attrName}={{ ${body} }}` }];
  }

  const obj = unparen(container.expression);
  if (obj.type !== 'ObjectExpression') {
    const body = setEntries.map(([k, v]) => fieldText(k, v)).join(', ');
    return [
      { start: container.expression.start, end: container.expression.end, text: `{ ${body} }` },
    ];
  }

  return setFieldsInObject(obj, fields);
}

const fieldText = (k: string, v: unknown) => `${k}: ${serializeValue(v)}`;

export function setFieldsInObject(obj: AstNode, fields: Record<string, unknown>): Edit[] {
  const entries = Object.entries(fields);
  const props = (obj.properties ?? []) as AstNode[];
  const propFor = (name: string): AstNode | undefined =>
    props.find(p => p.type === 'Property' && !p.computed && keyName(p.key) === name);

  const edits: Edit[] = [];
  const toInsert: string[] = [];
  const removeIdx = new Set<number>();
  for (const [k, v] of entries) {
    const prop = propFor(k);
    if (v === undefined) {
      if (prop) removeIdx.add(props.indexOf(prop));
      continue;
    }
    if (prop) {
      edits.push({ start: prop.value.start, end: prop.value.end, text: serializeValue(v) });
    } else {
      toInsert.push(fieldText(k, v));
    }
  }
  for (let i = 0; i < props.length; i++) {
    if (!removeIdx.has(i)) continue;
    let j = i;
    while (j + 1 < props.length && removeIdx.has(j + 1)) j++;
    if (j + 1 < props.length)
      edits.push({ start: props[i].start, end: props[j + 1].start, text: '' });
    else if (i > 0) edits.push({ start: props[i - 1].end, end: props[j].end, text: '' });
    else edits.push({ start: obj.start + 1, end: obj.end - 1, text: '' });
    i = j;
  }
  if (toInsert.length > 0) {
    let anchor = -1;
    for (let i = props.length - 1; i >= 0; i--) {
      if (!removeIdx.has(i)) {
        anchor = i;
        break;
      }
    }
    if (anchor >= 0) {
      edits.push({
        start: props[anchor].end,
        end: props[anchor].end,
        text: `, ${toInsert.join(', ')}`,
      });
    } else if (props.length > 0) {
      edits.push({ start: obj.end - 1, end: obj.end - 1, text: ` ${toInsert.join(', ')} ` });
    } else {
      edits.push({ start: obj.start + 1, end: obj.end - 1, text: ` ${toInsert.join(', ')} ` });
    }
  }
  return edits;
}

function propertyNamed(obj: AstNode, name: string): AstNode | undefined {
  return ((obj.properties ?? []) as AstNode[]).find(
    p => p.type === 'Property' && !p.computed && keyName(p.key) === name,
  );
}

export function setObjectProperty(
  obj: AstNode,
  propName: string,
  fields: Record<string, unknown>,
): Edit[] {
  const setEntries = Object.entries(fields).filter(([, v]) => v !== undefined);
  const prop = propertyNamed(obj, propName);

  if (!prop) {
    if (setEntries.length === 0) return [];
    return setFieldsInObject(obj, { [propName]: Object.fromEntries(setEntries) });
  }

  const value = unparen(prop.value as AstNode);
  if (value.type !== 'ObjectExpression') {
    const body = setEntries.map(([k, v]) => fieldText(k, v)).join(', ');
    return [{ start: value.start, end: value.end, text: `{ ${body} }` }];
  }
  return setFieldsInObject(value, fields);
}

export function removeObjectProperty(obj: AstNode, propName: string): Edit[] {
  const props = (obj.properties ?? []) as AstNode[];
  const i = props.findIndex(
    p => p.type === 'Property' && !p.computed && keyName(p.key) === propName,
  );
  if (i < 0) return [];
  if (props.length === 1) return [{ start: obj.start + 1, end: obj.end - 1, text: '' }];
  if (i > 0) return [{ start: props[i - 1].end, end: props[i].end, text: '' }];
  return [{ start: props[i].start, end: props[i + 1].start, text: '' }];
}

export function emitElement(
  node: Pick<CodeUINode, 'type' | 'uiTransform' | 'uiBackground' | 'uiText'>,
): string {
  const props: string[] = [];
  if (node.uiTransform)
    props.push(`uiTransform={${emitObject(node.uiTransform as Record<string, unknown>)}}`);
  if (node.uiBackground)
    props.push(`uiBackground={${emitObject(node.uiBackground as Record<string, unknown>)}}`);
  if (node.type === 'Label' && node.uiText) {
    const t = node.uiText as Record<string, unknown>;
    if (t.value !== undefined) props.push(jsxStringAttr('value', String(t.value)));
    if (t.fontSize !== undefined) props.push(`fontSize={${serializeValue(t.fontSize)}}`);
  }
  return `<${node.type}${props.length ? ' ' + props.join(' ') : ''} />`;
}

function lineIndent(source: string, pos: number): string {
  const lineStart = source.lastIndexOf('\n', pos - 1) + 1;
  const m = source.slice(lineStart, pos).match(/^\s*/);
  return m ? m[0] : '';
}

export function insertChild(parentEl: AstNode, source: string, childJsx: string): Edit[] {
  const closing = parentEl.closingElement as AstNode | undefined;
  if (closing) {
    const at = closing.start;
    const indent = lineIndent(source, at);
    return [{ start: at, end: at, text: `${childJsx}\n${indent}` }];
  }
  const open = parentEl.openingElement as AstNode;
  const tag = open.name?.name ?? 'UiEntity';
  const slashGt = source.lastIndexOf('/>', open.end);
  const at = slashGt >= 0 ? slashGt : open.end - 2;
  return [{ start: at, end: open.end, text: `>\n  ${childJsx}\n</${tag}>` }];
}

export function insertSibling(
  targetEl: AstNode,
  source: string,
  childJsx: string,
  position: 'before' | 'after',
): Edit[] {
  const indent = lineIndent(source, targetEl.start);
  if (position === 'before') {
    return [{ start: targetEl.start, end: targetEl.start, text: `${childJsx}\n${indent}` }];
  }
  return [{ start: targetEl.end, end: targetEl.end, text: `\n${indent}${childJsx}` }];
}

export function setReturnJsx(fnNode: AstNode, source: string, childJsx: string): Edit[] {
  const body = fnNode.body as AstNode | undefined;
  if (!body || body.type !== 'BlockStatement') return [];
  const stmts = (body.body ?? []) as AstNode[];
  const ret = stmts.find(s => s.type === 'ReturnStatement');
  const indent = lineIndent(source, (ret ?? body).start);
  const wrapped = `(\n${indent}  ${childJsx}\n${indent})`;
  if (ret) {
    const arg = ret.argument as AstNode | undefined;
    if (arg) return [{ start: arg.start, end: arg.end, text: wrapped }];
    const at = source.indexOf('return', ret.start) + 'return'.length;
    return [{ start: at, end: at, text: ` ${wrapped}` }];
  }
  const at = body.end - 1;
  return [{ start: at, end: at, text: `${indent}  return ${wrapped}\n${indent}` }];
}

export function removeReturnJsx(fnNode: AstNode): Edit[] {
  const body = fnNode.body as AstNode | undefined;
  if (!body || body.type !== 'BlockStatement') return [];
  const stmts = (body.body ?? []) as AstNode[];
  const ret = stmts.find(s => s.type === 'ReturnStatement');
  if (!ret || !ret.argument) return [];
  return [{ start: ret.start, end: ret.end, text: 'return' }];
}

export function insertStatementBeforeReturn(
  fnNode: AstNode,
  source: string,
  statement: string,
): Edit[] {
  const body = fnNode.body as AstNode | undefined;
  if (!body || body.type !== 'BlockStatement') return [];
  const stmts = (body.body ?? []) as AstNode[];
  const ret = stmts.find(s => s.type === 'ReturnStatement');
  const at = ret ? ret.start : body.end - 1;
  const indent = lineIndent(source, at);
  return [{ start: at, end: at, text: `${statement}\n${indent}` }];
}

export function toBlockBody(fnNode: AstNode, source: string): Edit[] {
  const body = fnNode.body as AstNode | undefined;
  if (!body || body.type === 'BlockStatement') return [];
  const indent = lineIndent(source, fnNode.start);
  const raw = source.slice(body.start, body.end);
  return [
    {
      start: body.start,
      end: body.end,
      text: `{\n${indent}  return ${raw}\n${indent}}`,
    },
  ];
}

function jsxStringAttr(name: string, value: string): string {
  const json = JSON.stringify(value);
  if (json === `"${value}"`) return `${name}=${json}`;
  return `${name}={${json}}`;
}

export function setAttribute(el: AstNode, name: string, value: unknown): Edit[] {
  const attrText =
    typeof value === 'string'
      ? jsxStringAttr(name, value)
      : typeof value === 'number' || typeof value === 'boolean'
        ? `${name}={${String(value)}}`
        : `${name}={${serializeValue(value)}}`;

  const attr = findAttr(el, name);
  if (!attr) {
    const at = el.openingElement.name.end;
    return [{ start: at, end: at, text: ` ${attrText}` }];
  }
  return [{ start: attr.start, end: attr.end, text: attrText }];
}

export function setAttributeExpr(el: AstNode, name: string, expr: string): Edit[] {
  const attrText = `${name}={${expr}}`;
  const attr = findAttr(el, name);
  if (!attr) {
    const at = el.openingElement.name.end;
    return [{ start: at, end: at, text: ` ${attrText}` }];
  }
  return [{ start: attr.start, end: attr.end, text: attrText }];
}

export function removeAttribute(el: AstNode, source: string, name: string): Edit[] {
  const attr = findAttr(el, name);
  if (!attr) return [];
  let start = attr.start;
  if (start > 0 && /\s/.test(source[start - 1])) start -= 1;
  return [{ start, end: attr.end, text: '' }];
}

export function setAttributes(
  el: AstNode,
  source: string,
  fields: Record<string, unknown>,
): Edit[] {
  const edits: Edit[] = [];
  for (const [name, value] of Object.entries(fields)) {
    if (value === undefined) edits.push(...removeAttribute(el, source, name));
    else edits.push(...setAttribute(el, name, value));
  }
  return edits;
}

export function setAttributeSegments(
  el: AstNode,
  name: string,
  segments: { kind: string; value: string }[],
): Edit[] {
  const hasBinding = segments.some(s => s.kind === 'binding');
  if (!hasBinding) {
    const text = segments.map(s => s.value).join('');
    return setAttribute(el, name, text);
  }
  if (segments.length === 1) {
    return setAttributeExpr(el, name, segments[0].value);
  }
  return setAttributeExpr(el, name, templateLiteralText(segments));
}

function templateLiteralText(segments: { kind: string; value: string }[]): string {
  const body = segments
    .map(s =>
      s.kind === 'binding'
        ? `\${${s.value}}`
        : s.value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${'),
    )
    .join('');
  return `\`${body}\``;
}

export function segmentsFieldValue(segments: { kind: string; value: string }[]): unknown {
  if (!segments.some(s => s.kind === 'binding')) return segments.map(s => s.value).join('');
  if (segments.length === 1) return raw(segments[0].value);
  return raw(templateLiteralText(segments));
}

export function removeNode(el: AstNode): Edit[] {
  return [{ start: el.start, end: el.end, text: '' }];
}

export function removeNodes(els: AstNode[]): Edit[] {
  const sorted = [...els].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Edit[] = [];
  let coveredEnd = -1;
  for (const el of sorted) {
    if (el.start < coveredEnd) continue;
    out.push(...removeNode(el));
    coveredEnd = el.end;
  }
  return out;
}

export function moveElement(source: string, el: AstNode, insertAt: number): Edit[] {
  const raw = source.slice(el.start, el.end);
  const text = insertAt >= el.end ? `\n${raw}` : `${raw}\n`;
  return [
    { start: el.start, end: el.end, text: '' },
    { start: insertAt, end: insertAt, text },
  ];
}

export function afterImports(program: { body?: AstNode[] }): number {
  let at = 0;
  for (const stmt of program.body ?? []) {
    if (stmt.type === 'ImportDeclaration') at = stmt.end;
    else break;
  }
  return at;
}

export function ensureNamedImport(
  program: { body?: AstNode[] },
  name: string,
  from: string,
): Edit[] {
  const namedGroups = ((program.body ?? []) as AstNode[])
    .filter(s => s.type === 'ImportDeclaration' && s.source?.value === from)
    .map(d => ((d.specifiers ?? []) as AstNode[]).filter(s => s.type === 'ImportSpecifier'));

  const isImported = namedGroups.some(specs =>
    specs.some(s => (s.imported?.name ?? s.local?.name) === name),
  );
  if (isImported) return [];

  const group = namedGroups.find(specs => specs.length > 0);
  if (group) {
    const last = group[group.length - 1];
    return [{ start: last.end, end: last.end, text: `, ${name}` }];
  }

  const at = afterImports(program);
  const line = `import { ${name} } from '${from}'`;
  return [{ start: at, end: at, text: at === 0 ? `${line}\n` : `\n${line}` }];
}
