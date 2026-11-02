import type { Edit } from './emit-adapter';

interface AstNode {
  type: string;
  start: number;
  end: number;
  [k: string]: any;
}

export interface StateVar {
  name: string;
  type: string;
  value?: string | number | boolean;
}

export interface StateNodes {
  object?: AstNode;
  interfaceBody?: AstNode;
}

function declOf(stmt: AstNode): AstNode | undefined {
  return stmt.type === 'ExportNamedDeclaration' ? (stmt.declaration as AstNode) : stmt;
}

const COLOR_KEYS = ['r', 'g', 'b'];

function tsAnnotationToType(ann: AstNode | undefined): string | null {
  const t = ann?.type;
  if (t === 'TSNumberKeyword') return 'number';
  if (t === 'TSStringKeyword') return 'string';
  if (t === 'TSBooleanKeyword') return 'boolean';
  if (t === 'TSArrayType' && (ann?.elementType as AstNode)?.type === 'TSStringKeyword') {
    return 'string[]';
  }
  if (t === 'TSTypeLiteral') {
    const names = ((ann?.members ?? []) as AstNode[])
      .filter(m => m.type === 'TSPropertySignature' && m.key?.type === 'Identifier')
      .map(m => m.key.name as string);
    if (COLOR_KEYS.every(k => names.includes(k))) return 'Color4';
  }
  return null;
}

function inferType(init: AstNode | undefined): string {
  if (init?.type === 'Literal') {
    if (typeof init.value === 'number') return 'number';
    if (typeof init.value === 'boolean') return 'boolean';
  }
  if (init?.type === 'ArrayExpression') return 'string[]';
  if (init?.type === 'ObjectExpression') {
    const names = ((init.properties ?? []) as AstNode[])
      .filter(pr => pr.type === 'Property' && pr.key?.type === 'Identifier')
      .map(pr => pr.key.name as string);
    if (COLOR_KEYS.every(k => names.includes(k))) return 'Color4';
  }
  if (
    init?.type === 'UnaryExpression' &&
    (init.operator === '-' || init.operator === '+') &&
    (init.argument as AstNode | undefined)?.type === 'Literal' &&
    typeof (init.argument as AstNode).value === 'number'
  )
    return 'number';
  return 'string';
}

function evalLiteral(init: AstNode | undefined): string | number | boolean | undefined {
  if (!init) return undefined;
  if (init.type === 'Literal') {
    const v = init.value;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
  }
  if (init.type === 'UnaryExpression' && init.operator === '-') {
    const a = evalLiteral(init.argument as AstNode);
    if (typeof a === 'number') return -a;
  }
  return undefined;
}

/** Format a user-entered default as the TS literal to splice into the state object, per the variable's type. */
export function literalForType(type: string, raw?: string): string {
  if (raw === undefined || raw === '') return STATE_DEFAULT[type] ?? "''";
  if (type === 'number') {
    const n = Number(raw);
    return Number.isFinite(n) ? String(n) : '0';
  }
  if (type === 'boolean') return raw === 'true' ? 'true' : 'false';
  return JSON.stringify(raw);
}

/** Locate the `state` const's object initializer and the interface body that types it. */
export function findStateNodes(program: AstNode): StateNodes {
  const interfaceByName = new Map<string, AstNode>();
  let stateDeclarator: AstNode | undefined;

  for (const stmt of (program.body ?? []) as AstNode[]) {
    const decl = declOf(stmt);
    if (!decl) continue;
    if (decl.type === 'TSInterfaceDeclaration' && decl.id?.name) {
      interfaceByName.set(decl.id.name as string, decl.body as AstNode);
    } else if (decl.type === 'VariableDeclaration') {
      for (const d of (decl.declarations ?? []) as AstNode[]) {
        if (d.id?.type === 'Identifier' && d.id.name === 'state') stateDeclarator = d;
      }
    }
  }

  if (!stateDeclarator) return {};
  const init = stateDeclarator.init as AstNode | undefined;
  const object = init && init.type === 'ObjectExpression' ? init : undefined;
  const typeName = stateDeclarator.id?.typeAnnotation?.typeAnnotation?.typeName?.name as
    | string
    | undefined;
  const interfaceBody =
    (typeName && interfaceByName.get(typeName)) || interfaceByName.get('State') || undefined;
  return { object, interfaceBody };
}

/** Read the bindable variables declared by the state convention, typed from the interface or inferred from the initializer. */
export function readStateVariables(program: AstNode): StateVar[] {
  const { object, interfaceBody } = findStateNodes(program);
  if (!object) return [];

  const typeByName = new Map<string, string>();
  for (const m of (interfaceBody?.body ?? []) as AstNode[]) {
    if (m.type === 'TSPropertySignature' && m.key?.type === 'Identifier') {
      const t = tsAnnotationToType(m.typeAnnotation?.typeAnnotation as AstNode);
      if (t) typeByName.set(m.key.name as string, t);
    }
  }

  const vars: StateVar[] = [];
  for (const prop of (object.properties ?? []) as AstNode[]) {
    if (prop.type !== 'Property' || prop.computed) continue;
    const key = prop.key?.type === 'Identifier' ? prop.key.name : prop.key?.value;
    if (key == null) continue;
    const name = String(key);
    vars.push({
      name,
      type: typeByName.get(name) ?? inferType(prop.value as AstNode),
      value: evalLiteral(prop.value as AstNode),
    });
  }
  return vars;
}

const STATE_DEFAULT: Record<string, string> = {
  number: '0',
  string: "''",
  boolean: 'false',
  Color4: '{ r: 1, g: 1, b: 1, a: 1 }',
  'string[]': '[]',
};

const TYPE_ANNOTATION: Record<string, string> = {
  Color4: '{ r: number; g: number; b: number; a: number }',
};

const annotationFor = (type: string): string => TYPE_ANNOTATION[type] ?? type;

/** Produce the edits that add `name` to the `state` object (and its typing interface); [] when no `state` object exists. */
export function addStateProperty(
  program: AstNode,
  name: string,
  type: string,
  rawDefault?: string,
): Edit[] {
  const { object, interfaceBody } = findStateNodes(program);
  if (!object) return [];
  const value = literalForType(type, rawDefault);
  const edits: Edit[] = [];

  const props = (object.properties ?? []) as AstNode[];
  if (props.length > 0) {
    const last = props[props.length - 1];
    edits.push({ start: last.end, end: last.end, text: `,\n  ${name}: ${value}` });
  } else {
    edits.push({ start: object.start + 1, end: object.end - 1, text: `\n  ${name}: ${value},\n` });
  }

  if (interfaceBody) {
    const members = (interfaceBody.body ?? []) as AstNode[];
    if (members.length > 0) {
      const last = members[members.length - 1];
      edits.push({ start: last.end, end: last.end, text: `\n  ${name}: ${annotationFor(type)}` });
    } else {
      edits.push({
        start: interfaceBody.start + 1,
        end: interfaceBody.end - 1,
        text: `\n  ${name}: ${type}\n`,
      });
    }
  }

  return edits;
}

function keyNameOf(prop: AstNode): string | null {
  const key = prop.key?.type === 'Identifier' ? prop.key.name : prop.key?.value;
  return key == null ? null : String(key);
}

interface PropertyLocation {
  object?: AstNode;
  props: AstNode[];
  prop?: AstNode;
  propIndex: number;
  interfaceBody?: AstNode;
  members: AstNode[];
  member?: AstNode;
  memberIndex: number;
}

function locateProperty(program: AstNode, name: string): PropertyLocation {
  const { object, interfaceBody } = findStateNodes(program);
  const props = (object?.properties ?? []) as AstNode[];
  const propIndex = props.findIndex(
    p => p.type === 'Property' && !p.computed && keyNameOf(p) === name,
  );
  const members = (interfaceBody?.body ?? []) as AstNode[];
  const memberIndex = members.findIndex(
    m => m.type === 'TSPropertySignature' && m.key?.type === 'Identifier' && m.key.name === name,
  );
  return {
    object,
    props,
    prop: propIndex >= 0 ? props[propIndex] : undefined,
    propIndex,
    interfaceBody,
    members,
    member: memberIndex >= 0 ? members[memberIndex] : undefined,
    memberIndex,
  };
}

function spanRemovingElement(list: AstNode[], i: number, container: AstNode): Edit {
  const el = list[i];
  if (list.length === 1) return { start: container.start + 1, end: container.end - 1, text: '' };
  if (i > 0) return { start: list[i - 1].end, end: el.end, text: '' };
  return { start: el.start, end: list[i + 1].start, text: '' };
}

/** Remove a state variable: delete its object property and, when typed, its interface member; [] when not found. */
export function removeStateProperty(program: AstNode, name: string): Edit[] {
  const loc = locateProperty(program, name);
  const edits: Edit[] = [];
  if (loc.prop && loc.object) edits.push(spanRemovingElement(loc.props, loc.propIndex, loc.object));
  if (loc.member && loc.interfaceBody)
    edits.push(spanRemovingElement(loc.members, loc.memberIndex, loc.interfaceBody));
  return edits;
}

/** Change a state variable's type: rewrite its interface member's annotation and reset its initializer to the new type's default; [] when not found. */
export function setStatePropertyType(program: AstNode, name: string, newType: string): Edit[] {
  const loc = locateProperty(program, name);
  if (!loc.prop) return [];
  const edits: Edit[] = [];
  const value = STATE_DEFAULT[newType] ?? "''";
  edits.push({ start: loc.prop.value.start, end: loc.prop.value.end, text: value });
  const ann = loc.member?.typeAnnotation?.typeAnnotation as AstNode | undefined;
  if (ann) edits.push({ start: ann.start, end: ann.end, text: newType });
  return edits;
}

/** Set a state variable's default value: replace its object initializer with `rawDefault` formatted per `type`; [] when not found. */
export function setStatePropertyValue(
  program: AstNode,
  name: string,
  type: string,
  rawDefault: string,
): Edit[] {
  const loc = locateProperty(program, name);
  if (!loc.prop) return [];
  return [
    {
      start: loc.prop.value.start,
      end: loc.prop.value.end,
      text: literalForType(type, rawDefault),
    },
  ];
}
