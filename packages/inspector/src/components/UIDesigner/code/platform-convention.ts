// The platform-variant convention — a STRUCTURAL desktop/mobile split. When a UI
// needs a genuinely different subtree per device (a phone menu vs a desktop bar),
// it branches on the reported platform:
//
//   const platform = usePlatform()
//   return platform === 'mobile' ? <MobileMenu /> : <DesktopBar />
//
// …and the same as a conditional child inside a parent.
//
// Why a recognized construct: a ConditionalExpression child is otherwise an
// OPAQUE node (parse-adapter, the 'conditional' reason), and opaque nodes render
// `children: []` — so an unrecognized conditional makes its whole subtree vanish
// from the canvas. Recognizing the platform shape turns it into a pass-through
// node with two first-class, individually editable branches instead.
//
// Per-PROPERTY overrides (`mobile: { uiTransform: { width } }`) are deliberately
// NOT modeled: proportional responsiveness is already handled at runtime by
// pixel-ratio scaling, so only genuinely different subtrees need authoring.
//
// This module locates and rewrites the construct; it evaluates nothing (the
// branches are ordinary elements parse-adapter already reads). Dependency-free
// apart from the emit-adapter Edit builders, so it unit-tests in isolation.

import type { DeviceKind } from '../shared/safe-areas';
import { type Edit, ensureNamedImport, insertStatementBeforeReturn } from './emit-adapter';

interface AstNode {
  type: string;
  start: number;
  end: number;
  [k: string]: any;
}

const PLATFORM_HELPER = 'usePlatform';

// Desktop first, so a variant's branches list in a stable order regardless of
// which side the author put the mobile test on.
export const PLATFORMS = ['desktop', 'mobile'] as const;

function isPlatformLiteral(v: unknown): v is DeviceKind {
  return v === 'desktop' || v === 'mobile';
}

export interface PlatformVariantAst {
  // The node whose FULL span the conditional occupies: the `{…}` container when
  // it's a JSX child, the ConditionalExpression itself at the component's
  // `return`. Unwrapping replaces this span — replacing only the conditional
  // would leave `{<El/>}` behind, which parses back as an opaque expression child.
  outer: AstNode;
  conditional: AstNode;
  // Each platform's branch slot: a JSXElement, or the `null` literal standing in
  // for a branch that isn't authored yet.
  desktop: AstNode;
  mobile: AstNode;
}

// The JSXElement a branch slot holds, or null when that branch is unauthored.
export function branchElement(slot: AstNode): AstNode | null {
  return slot.type === 'JSXElement' ? slot : null;
}

function unparen(node: AstNode): AstNode {
  let n = node;
  while (n && n.type === 'ParenthesizedExpression') n = n.expression as AstNode;
  return n;
}

// Statements of a component function's block body (or [] for a concise arrow) —
// the scope a `const platform = usePlatform()` resolves against.
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

// The `const <name> = usePlatform()` declaration in scope, when present. Reused
// rather than re-declared when a second node gains variants.
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

// `platform === 'mobile'` — also accepted: `!==`, reversed operands, and an
// inline `usePlatform() === …`. Returns the compared platform plus whether the
// test is negated, so the caller can map consequent/alternate onto the platforms.
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

// Parse a platform conditional from a JSX child container or from the expression
// a component returns. Returns null for any other conditional — those keep
// collapsing to an opaque node, exactly as before this convention existed.
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
  // Both sides must be a representable element or an explicit `null`; anything
  // else stays opaque rather than half-owned by the editor. At least one side
  // must be an element, or there is nothing to render.
  if (!isBranchSlot(consequent) || !isBranchSlot(alternate)) return null;
  if (!branchElement(consequent) && !branchElement(alternate)) return null;

  const matched = test.negated ? alternate : consequent;
  const other = test.negated ? consequent : alternate;
  return test.platform === 'mobile'
    ? { outer: node, conditional: inner, mobile: matched, desktop: other }
    : { outer: node, conditional: inner, desktop: matched, mobile: other };
}

// ---------------------------------------------------------------------------
// Write side — Edit builders. Each splices the smallest span expressing the
// change, so the branch the edit doesn't touch survives byte-for-byte.
// ---------------------------------------------------------------------------

export function platformStatement(varName: string): string {
  return `const ${varName} = ${PLATFORM_HELPER}()`;
}

// Wrap an element in a platform conditional: it becomes the DESKTOP branch and
// `seedJsx` seeds the mobile one. The element's source moves VERBATIM, so nothing
// the parser can't round-trip is lost. `braced` emits the JSX expression
// container a child needs and a `return` argument must not have; `declare` is
// false when a `usePlatform()` const is already in scope.
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

// Fill in a branch that isn't authored yet — a hand-written one-sided conditional
// (`platform === 'mobile' ? <A /> : null`). No-op when the branch exists.
export function addPlatformBranchEdits(
  ast: PlatformVariantAst,
  platform: DeviceKind,
  jsx: string,
): Edit[] {
  const slot = ast[platform];
  if (branchElement(slot)) return [];
  return [{ start: slot.start, end: slot.end, text: jsx }];
}

// Collapse the conditional back to a single node, keeping one branch. The other
// branch is dropped — that IS "remove the platform variant". The
// `const platform = usePlatform()` statement is intentionally left in place: it
// costs nothing (the scene tsconfig sets no `noUnusedLocals`) and the next wrap
// reuses it.
export function unwrapPlatformEdits(
  ast: PlatformVariantAst,
  keep: DeviceKind,
  source: string,
): Edit[] {
  const el = branchElement(ast[keep]);
  if (!el) return [];
  return [{ start: ast.outer.start, end: ast.outer.end, text: source.slice(el.start, el.end) }];
}
