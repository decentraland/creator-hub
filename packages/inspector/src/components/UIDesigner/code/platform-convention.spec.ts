import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';

import { applyEdits, toBlockBody } from './emit-adapter';
import { findComponentFn } from './parse-adapter';
import {
  addPlatformBranchEdits,
  branchElement,
  componentStatements,
  findPlatformConst,
  parsePlatformConditional,
  type PlatformVariantAst,
  platformStatement,
  unwrapPlatformEdits,
  wrapInPlatformEdits,
} from './platform-convention';

// These helpers take the raw ESTree PROGRAM, so obtain it via parseSync directly.
const prog = (source: string) => parseSync('Ui.tsx', source).program as any;

const componentOf = (source: string) => findComponentFn(prog(source)) as any;

// The expression the component returns, plus the statements it's scoped by —
// mirroring what parse-adapter feeds parsePlatformConditional.
function returned(source: string): { expr: any; statements: any[] } {
  const fn = componentOf(source);
  const statements = componentStatements(fn);
  // A concise-body arrow has no statements — its body IS the returned expression.
  let expr = statements.length
    ? statements.find((s: any) => s.type === 'ReturnStatement')?.argument
    : fn?.body;
  while (expr?.type === 'ParenthesizedExpression') expr = expr.expression;
  return { expr, statements };
}

// The sole JSX child expression container of the returned element.
function soleChildContainer(source: string): { expr: any; statements: any[] } {
  const { expr, statements } = returned(source);
  const container = (expr?.children ?? []).find((c: any) => c.type === 'JSXExpressionContainer');
  return { expr: container, statements };
}

function resolveRoot(source: string): PlatformVariantAst | null {
  const { expr, statements } = returned(source);
  return parsePlatformConditional(expr, statements);
}

function resolveChild(source: string): PlatformVariantAst | null {
  const { expr, statements } = soleChildContainer(source);
  return parsePlatformConditional(expr, statements);
}

const ROOT_FORM = `export function Ui() {
  const platform = usePlatform()
  return platform === 'mobile' ? <MobileMenu /> : <DesktopBar />
}`;

const CHILD_FORM = `export function Ui() {
  const platform = usePlatform()
  return (
    <UiEntity uiTransform={{ width: 400 }}>
      {platform === 'mobile' ? <Phone /> : <Desk />}
    </UiEntity>
  )
}`;

describe('when parsing the platform convention', () => {
  it('should resolve the returned conditional through the platform const', () => {
    const ast = resolveRoot(ROOT_FORM)!;
    expect(ROOT_FORM.slice(ast.mobile.start, ast.mobile.end)).toBe('<MobileMenu />');
    expect(ROOT_FORM.slice(ast.desktop.start, ast.desktop.end)).toBe('<DesktopBar />');
    // The root form has no expression container, so `outer` IS the conditional.
    expect(ast.outer).toBe(ast.conditional);
  });

  it('should resolve a conditional child and keep the container as the outer span', () => {
    const ast = resolveChild(CHILD_FORM)!;
    expect(CHILD_FORM.slice(ast.mobile.start, ast.mobile.end)).toBe('<Phone />');
    expect(CHILD_FORM.slice(ast.desktop.start, ast.desktop.end)).toBe('<Desk />');
    expect(CHILD_FORM.slice(ast.outer.start, ast.outer.end).startsWith('{')).toBe(true);
  });

  it('should map the branches by the compared literal, not by position', () => {
    const src = `export function Ui() {
  const platform = usePlatform()
  return platform === 'desktop' ? <Desk /> : <Phone />
}`;
    const ast = resolveRoot(src)!;
    expect(src.slice(ast.desktop.start, ast.desktop.end)).toBe('<Desk />');
    expect(src.slice(ast.mobile.start, ast.mobile.end)).toBe('<Phone />');
  });

  it('should flip the branches for a negated test', () => {
    const src = `export function Ui() {
  const platform = usePlatform()
  return platform !== 'mobile' ? <Desk /> : <Phone />
}`;
    const ast = resolveRoot(src)!;
    expect(src.slice(ast.desktop.start, ast.desktop.end)).toBe('<Desk />');
    expect(src.slice(ast.mobile.start, ast.mobile.end)).toBe('<Phone />');
  });

  it('should accept reversed operands', () => {
    const src = `export function Ui() {
  const platform = usePlatform()
  return 'mobile' === platform ? <Phone /> : <Desk />
}`;
    const ast = resolveRoot(src)!;
    expect(src.slice(ast.mobile.start, ast.mobile.end)).toBe('<Phone />');
  });

  it('should accept an inline usePlatform() call with no const in scope', () => {
    const src = `export const Ui = () =>
  usePlatform() === 'mobile' ? <Phone /> : <Desk />`;
    const ast = resolveRoot(src)!;
    expect(src.slice(ast.mobile.start, ast.mobile.end)).toBe('<Phone />');
  });

  it('should report a one-sided conditional as a missing branch', () => {
    const src = `export function Ui() {
  const platform = usePlatform()
  return (
    <UiEntity>
      {platform === 'mobile' ? <Phone /> : null}
    </UiEntity>
  )
}`;
    const ast = resolveChild(src)!;
    expect(branchElement(ast.mobile)).toBeTruthy();
    expect(branchElement(ast.desktop)).toBeNull();
  });

  it('should refuse a conditional on anything but the platform', () => {
    expect(
      resolveRoot(`export function Ui() {
  return state.open ? <A /> : <B />
}`),
    ).toBeNull();
  });

  it('should refuse an identifier that is not bound to usePlatform()', () => {
    expect(
      resolveRoot(`export function Ui() {
  const platform = getDevice()
  return platform === 'mobile' ? <A /> : <B />
}`),
    ).toBeNull();
  });

  it('should refuse an unrelated platform literal', () => {
    expect(
      resolveRoot(`export function Ui() {
  const platform = usePlatform()
  return platform === 'web' ? <A /> : <B />
}`),
    ).toBeNull();
  });

  it('should refuse a branch that is neither an element nor null', () => {
    expect(
      resolveRoot(`export function Ui() {
  const platform = usePlatform()
  return platform === 'mobile' ? renderPhone() : <Desk />
}`),
    ).toBeNull();
  });

  it('should refuse a conditional with no element on either side', () => {
    expect(
      resolveRoot(`export function Ui() {
  const platform = usePlatform()
  return platform === 'mobile' ? null : null
}`),
    ).toBeNull();
  });

  it('should find the platform const so a second wrap reuses it', () => {
    const { statements } = returned(ROOT_FORM);
    expect(findPlatformConst(statements)?.name).toBe('platform');
    const plain = returned(`export function Ui() {
  return <A />
}`);
    expect(findPlatformConst(plain.statements)).toBeNull();
  });
});

describe('when wrapping a node in platform variants', () => {
  const PLAIN_ROOT = `/** @jsx ReactEcs.createElement */
import ReactEcs, { UiEntity } from '@dcl/sdk/react-ecs'

export function Ui() {
  return (
    <UiEntity uiTransform={{ width: 400, height: 200 }} />
  )
}
`;

  const SEED = '<UiEntity uiTransform={{ width: 200, height: 100 }} />';

  function wrap(source: string, opts: { braced: boolean; el?: (root: any) => any }) {
    const program = prog(source);
    const fn = findComponentFn(program) as any;
    const statements = componentStatements(fn);
    const ret = statements.find((s: any) => s.type === 'ReturnStatement');
    let root = ret?.argument;
    while (root?.type === 'ParenthesizedExpression') root = root.expression;
    const el = opts.el ? opts.el(root) : root;
    const existing = findPlatformConst(statements);
    return applyEdits(
      source,
      wrapInPlatformEdits({
        program,
        fnNode: fn,
        el,
        source,
        varName: existing?.name ?? 'platform',
        declare: !existing,
        importFrom: './platform',
        seedJsx: SEED,
        braced: opts.braced,
      }),
    );
  }

  it('should produce source that parses back as a recognized variant', () => {
    const next = wrap(PLAIN_ROOT, { braced: false });
    expect(parseSync('Ui.tsx', next).errors).toHaveLength(0);
    const ast = resolveRoot(next)!;
    expect(next.slice(ast.desktop.start, ast.desktop.end)).toContain('width: 400');
    expect(next.slice(ast.mobile.start, ast.mobile.end)).toBe(SEED);
  });

  it('should keep the wrapped node as the desktop branch verbatim', () => {
    const next = wrap(PLAIN_ROOT, { braced: false });
    expect(next).toContain('uiTransform={{ width: 400, height: 200 }}');
  });

  it('should add the helper import and declare the platform const', () => {
    const next = wrap(PLAIN_ROOT, { braced: false });
    expect(next).toContain("import { usePlatform } from './platform'");
    expect(next).toContain('const platform = usePlatform()');
  });

  it('should brace the conditional when the target is a JSX child', () => {
    const src = `/** @jsx ReactEcs.createElement */
import ReactEcs, { UiEntity, Label } from '@dcl/sdk/react-ecs'

export function Ui() {
  return (
    <UiEntity>
      <Label value="hi" />
    </UiEntity>
  )
}
`;
    const next = wrap(src, {
      braced: true,
      el: root => root.children.find((c: any) => c.type === 'JSXElement'),
    });
    expect(parseSync('Ui.tsx', next).errors).toHaveLength(0);
    const ast = resolveChild(next)!;
    expect(next.slice(ast.desktop.start, ast.desktop.end)).toBe('<Label value="hi" />');
  });

  it('should reuse an existing platform const instead of redeclaring it', () => {
    const src = `/** @jsx ReactEcs.createElement */
import ReactEcs, { UiEntity, Label } from '@dcl/sdk/react-ecs'
import { usePlatform } from './platform'

export function Ui() {
  const platform = usePlatform()
  return (
    <UiEntity>
      <Label value="hi" />
    </UiEntity>
  )
}
`;
    const next = wrap(src, {
      braced: true,
      el: root => root.children.find((c: any) => c.type === 'JSXElement'),
    });
    expect(parseSync('Ui.tsx', next).errors).toHaveLength(0);
    expect(next.match(/const platform = usePlatform\(\)/g)).toHaveLength(1);
    expect(next.match(/import \{ usePlatform \}/g)).toHaveLength(1);
    expect(branchElement(resolveChild(next)!.mobile)).toBeTruthy();
  });

  // The store converts a concise-body arrow to a block FIRST (toBlockBody), then
  // wraps against the reparsed source — insertStatementBeforeReturn has no block
  // to splice into otherwise, so the const would never be declared and the test
  // identifier would resolve to nothing (collapsing the node to opaque).
  it('should wrap a concise-body arrow component after converting it to a block', () => {
    const src = `/** @jsx ReactEcs.createElement */
import ReactEcs, { UiEntity } from '@dcl/sdk/react-ecs'

export const Hud = () => <UiEntity uiTransform={{ width: 10 }} />
`;
    const blocked = applyEdits(src, toBlockBody(componentOf(src), src));
    expect(parseSync('Ui.tsx', blocked).errors).toHaveLength(0);
    const next = wrap(blocked, { braced: false });
    expect(parseSync('Ui.tsx', next).errors).toHaveLength(0);
    expect(next).toContain('const platform = usePlatform()');
    expect(resolveRoot(next)).toBeTruthy();
  });
});

describe('when editing an existing variant', () => {
  const SEED = '<UiEntity />';

  it('should fill a missing branch in place', () => {
    const src = `export function Ui() {
  const platform = usePlatform()
  return (
    <UiEntity>
      {platform === 'mobile' ? <Phone /> : null}
    </UiEntity>
  )
}`;
    const next = applyEdits(src, addPlatformBranchEdits(resolveChild(src)!, 'desktop', SEED));
    expect(parseSync('Ui.tsx', next).errors).toHaveLength(0);
    expect(next).toContain(`? <Phone /> : ${SEED}`);
    expect(branchElement(resolveChild(next)!.desktop)).toBeTruthy();
  });

  it('should leave an existing branch alone', () => {
    expect(addPlatformBranchEdits(resolveChild(CHILD_FORM)!, 'mobile', SEED)).toEqual([]);
  });

  it('should unwrap the returned conditional back to one element', () => {
    const next = applyEdits(
      ROOT_FORM,
      unwrapPlatformEdits(resolveRoot(ROOT_FORM)!, 'desktop', ROOT_FORM),
    );
    expect(parseSync('Ui.tsx', next).errors).toHaveLength(0);
    expect(next).toContain('return <DesktopBar />');
    expect(next).not.toContain('<MobileMenu />');
    expect(resolveRoot(next)).toBeNull();
  });

  // Replacing only the conditional would leave `{<Desk />}` — which parses back
  // as an opaque expression child, not a first-class element.
  it('should replace the whole expression container when unwrapping a child', () => {
    const next = applyEdits(
      CHILD_FORM,
      unwrapPlatformEdits(resolveChild(CHILD_FORM)!, 'desktop', CHILD_FORM),
    );
    expect(parseSync('Ui.tsx', next).errors).toHaveLength(0);
    expect(next).toContain('<Desk />');
    expect(next).not.toContain('{<Desk />}');
    expect(next).not.toContain('<Phone />');
  });

  it('should refuse to unwrap onto a branch that does not exist', () => {
    const src = `export function Ui() {
  const platform = usePlatform()
  return (
    <UiEntity>
      {platform === 'mobile' ? <Phone /> : null}
    </UiEntity>
  )
}`;
    expect(unwrapPlatformEdits(resolveChild(src)!, 'desktop', src)).toEqual([]);
  });
});

describe('when building the platform statement', () => {
  it('should declare the const the recognizer resolves against', () => {
    expect(platformStatement('platform')).toBe('const platform = usePlatform()');
  });
});
