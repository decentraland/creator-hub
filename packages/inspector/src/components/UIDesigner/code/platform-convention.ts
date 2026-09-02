import type { DeviceKind } from '../shared/safe-areas';
import { type Edit, ensureNamedImport, insertStatementBeforeReturn } from './emit-adapter';

interface AstNode {
  type: string;
  start: number;
  end: number;
  [k: string]: any;
}

const PLATFORM_HELPER = 'usePlatform';

/** Platform kinds, desktop first for a stable branch order. */
export const PLATFORMS = ['desktop', 'mobile'] as const;

function isPlatformLiteral(v: unknown): v is DeviceKind {
  return v === 'desktop' || v === 'mobile';
}

export interface PlatformVariantAst {
  outer: AstNode;
  conditional: AstNode;
  desktop: AstNode;
  mobile: AstNode;
}

/** The JSXElement a branch slot holds, or null when that branch is unauthored. */
export function branchElement(slot: AstNode): AstNode | null {
  return slot.type === 'JSXElement' ? slot : null;
}

function unparen(node: AstNode): AstNode {
  let n = node;
  while (n && n.type === 'ParenthesizedExpression') n = n.expression as AstNode;
  return n;
}

/** Statements of a component function's block body (or [] for a concise arrow). */
export function componentStatements(fnNode: AstNode | null | undefined): AstNode[] {
  const body = fnNode?.body as AstNode | undefined;
  if (!body || body.type !== 'BlockStatement') return [];
  return (body.body ?? []) as AstNode[];
}

function isPlatformCall(node: AstNode | undefined): boolean {
  return (
    !!node &&
    node.type === 'CallExpression' &&
    node.callee?.type === 'Identifier' &&
    node.callee.name === PLATFORM_HELPER
  );
}

/** The `const <name> = usePlatform()` declaration in scope, when present. */
export function findPlatformConst(
  statements: AstNode[],
): { name: string; declaration: AstNode } | null {
  for (const stmt of statements) {
    if (stmt.type !== 'VariableDeclaration') continue;
    for (const d of (stmt.declarations ?? []) as AstNode[]) {
      if (d.id?.type !== 'Identifier') continue;
      if (isPlatformCall(d.init ? unparen(d.init as AstNode) : undefined)) {
        return { name: d.id.name as string, declaration: stmt };
      }
    }
  }
  return null;
}

function readPlatformTest(
  test: AstNode,
  statements: AstNode[],
): { platform: DeviceKind; negated: boolean } | null {
  const t = unparen(test);
  if (t.type !== 'BinaryExpression') return null;
  if (t.operator !== '===' && t.operator !== '!==') return null;
  let ref = unparen(t.left as AstNode);
  let lit = unparen(t.right as AstNode);
  if (ref.type === 'Literal') [ref, lit] = [lit, ref];
  if (lit.type !== 'Literal' || !isPlatformLiteral(lit.value)) return null;
  if (!isPlatformCall(ref)) {
    if (ref.type !== 'Identifier') return null;
    const decl = findPlatformConst(statements);
    if (!decl || decl.name !== ref.name) return null;
  }
  return { platform: lit.value, negated: t.operator === '!==' };
}

function isBranchSlot(node: AstNode): boolean {
  return node.type === 'JSXElement' || (node.type === 'Literal' && node.value === null);
}

/** Parse a platform conditional from a JSX child container or a component's return expression; null for any other conditional. */
export function parsePlatformConditional(
  node: AstNode | undefined,
  statements: AstNode[],
): PlatformVariantAst | null {
  if (!node) return null;
  const inner = unparen(
    node.type === 'JSXExpressionContainer' ? (node.expression as AstNode) : node,
  );
  if (!inner || inner.type !== 'ConditionalExpression') return null;
  const test = readPlatformTest(inner.test as AstNode, statements);
  if (!test) return null;

  const consequent = unparen(inner.consequent as AstNode);
  const alternate = unparen(inner.alternate as AstNode);
  if (!isBranchSlot(consequent) || !isBranchSlot(alternate)) return null;
  if (!branchElement(consequent) && !branchElement(alternate)) return null;

  const matched = test.negated ? alternate : consequent;
  const other = test.negated ? consequent : alternate;
  return test.platform === 'mobile'
    ? { outer: node, conditional: inner, mobile: matched, desktop: other }
    : { outer: node, conditional: inner, desktop: matched, mobile: other };
}

export function platformStatement(varName: string): string {
  return `const ${varName} = ${PLATFORM_HELPER}()`;
}

/** Wrap an element in a platform conditional: it becomes the desktop branch and `seedJsx` seeds the mobile one. */
export function wrapInPlatformEdits(args: {
  program: { body?: AstNode[] };
  fnNode: AstNode;
  el: AstNode;
  source: string;
  varName: string;
  declare: boolean;
  importFrom: string;
  seedJsx: string;
  braced: boolean;
}): Edit[] {
  const { program, fnNode, el, source, varName, declare, importFrom, seedJsx, braced } = args;
  const expr = `${varName} === 'mobile' ? ${seedJsx} : ${source.slice(el.start, el.end)}`;
  return [
    ...ensureNamedImport(program, PLATFORM_HELPER, importFrom),
    ...(declare ? insertStatementBeforeReturn(fnNode, source, platformStatement(varName)) : []),
    { start: el.start, end: el.end, text: braced ? `{${expr}}` : expr },
  ];
}

/** Fill in a branch that isn't authored yet; no-op when the branch exists. */
export function addPlatformBranchEdits(
  ast: PlatformVariantAst,
  platform: DeviceKind,
  jsx: string,
): Edit[] {
  const slot = ast[platform];
  if (branchElement(slot)) return [];
  return [{ start: slot.start, end: slot.end, text: jsx }];
}

/** Collapse the conditional back to a single node, keeping one branch and dropping the other. */
export function unwrapPlatformEdits(
  ast: PlatformVariantAst,
  keep: DeviceKind,
  source: string,
): Edit[] {
  const el = branchElement(ast[keep]);
  if (!el) return [];
  return [{ start: ast.outer.start, end: ast.outer.end, text: source.slice(el.start, el.end) }];
}
