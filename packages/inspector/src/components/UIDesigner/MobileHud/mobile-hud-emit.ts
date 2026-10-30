/**
 * Emit and parse the scene's `src/mobile-hud.ts` module — a `TouchScreenControls`
 * setup call, the code-as-source form of a {@link MobileHudConfig}. Lives outside
 * `src/ui/` so the root scanner never treats it as a GUI. See `mobile-hud-store.ts`
 * for the lazy write / auto-clean persistence.
 *
 * @module
 */
import { keyName, unparen } from '../code/ast-utils';
import type { Edit } from '../code/emit-adapter';
import { afterImports, ensureNamedImport } from '../code/emit-adapter';
import type { MobileAction, MobileButtonConfig, MobileHudConfig } from './mobile-hud-config';
import { DEFAULT_MAIN_ACTION, defaultMobileHudConfig, MOBILE_ACTIONS } from './mobile-hud-config';

export const MOBILE_HUD_MODULE = 'src/mobile-hud.ts';
export const MOBILE_HUD_IMPORT = './mobile-hud';
export const MOBILE_HUD_SETUP = 'setupMobileHud';

const ACTION_SET = new Set<string>(MOBILE_ACTIONS);
const sq = (s: string) => `'${s.replace(/'/g, "\\'")}'`;

function iconLiteral(src: string): string {
  return `icon: { tex: { $case: 'texture', texture: { src: ${sq(src)} } } }`;
}

function touchInputLine(action: MobileAction, button: MobileButtonConfig): string | null {
  if (!button.hide && button.icon === undefined) return null;
  const parts = [`inputAction: InputAction.${action}`, `hide: ${button.hide}`];
  if (button.icon !== undefined) parts.push(iconLiteral(button.icon));
  return `      { ${parts.join(', ')} },`;
}

export function generateMobileHudModule(config: MobileHudConfig): string {
  const lines: string[] = [
    `    hideJoystick: ${config.hideJoystick},`,
    `    hideCrosshair: ${config.hideCrosshair},`,
  ];
  if (config.mainAction !== DEFAULT_MAIN_ACTION) {
    lines.push(`    mainAction: InputAction.${config.mainAction},`);
  }
  const inputs = MOBILE_ACTIONS.map(action =>
    touchInputLine(action, config.buttons[action]),
  ).filter((line): line is string => line !== null);
  if (inputs.length > 0) {
    lines.push('    touchInputs: [', ...inputs, '    ],');
  } else {
    lines.push('    touchInputs: [],');
  }
  return `import { engine, InputAction, TouchScreenControls } from '@dcl/sdk/ecs'

export function ${MOBILE_HUD_SETUP}() {
  TouchScreenControls.createOrReplace(engine.RootEntity, {
${lines.join('\n')}
  })
}
`;
}

interface AstNode {
  type: string;
  start: number;
  end: number;
  [k: string]: any;
}

function getProp(obj: AstNode, name: string): AstNode | undefined {
  const prop = ((obj.properties ?? []) as AstNode[]).find(
    p => p.type === 'Property' && !p.computed && keyName(p.key) === name,
  );
  return prop ? unparen(prop.value as AstNode) : undefined;
}

function boolOf(node: AstNode | undefined): boolean {
  return (
    !!node && (node.type === 'Literal' || node.type === 'BooleanLiteral') && node.value === true
  );
}

function inputActionOf(node: AstNode | undefined): MobileAction | null {
  if (
    node?.type === 'MemberExpression' &&
    node.object?.type === 'Identifier' &&
    node.object.name === 'InputAction' &&
    node.property?.type === 'Identifier' &&
    ACTION_SET.has(node.property.name)
  ) {
    return node.property.name as MobileAction;
  }
  return null;
}

function iconSrcOf(node: AstNode | undefined): string | undefined {
  if (!node || node.type !== 'ObjectExpression') return undefined;
  const texture = getProp(getProp(node, 'tex') as AstNode, 'texture');
  const src = texture && getProp(texture, 'src');
  return src && src.type === 'Literal' && typeof src.value === 'string' ? src.value : undefined;
}

function walk(node: any, visit: (n: AstNode) => boolean): AstNode | null {
  if (!node || typeof node !== 'object') return null;
  if (typeof node.type === 'string' && visit(node)) return node;
  for (const key of Object.keys(node)) {
    const value = node[key];
    const children = Array.isArray(value) ? value : [value];
    for (const child of children) {
      if (child && typeof child === 'object') {
        const found = walk(child, visit);
        if (found) return found;
      }
    }
  }
  return null;
}

function findTouchCall(program: unknown): AstNode | null {
  return walk(program, node => {
    const callee = node.type === 'CallExpression' ? node.callee : undefined;
    return (
      callee?.type === 'MemberExpression' &&
      callee.object?.type === 'Identifier' &&
      callee.object.name === 'TouchScreenControls' &&
      callee.property?.name === 'createOrReplace'
    );
  });
}

export function parseMobileHudConfig(program: unknown, _source: string): MobileHudConfig {
  const config = defaultMobileHudConfig();
  const call = findTouchCall(program);
  const arg = call?.arguments?.[1] as AstNode | undefined;
  if (!arg || arg.type !== 'ObjectExpression') return config;

  config.hideJoystick = boolOf(getProp(arg, 'hideJoystick'));
  config.hideCrosshair = boolOf(getProp(arg, 'hideCrosshair'));
  const main = inputActionOf(getProp(arg, 'mainAction'));
  if (main) config.mainAction = main;

  const inputs = getProp(arg, 'touchInputs');
  if (inputs?.type === 'ArrayExpression') {
    for (const el of (inputs.elements ?? []) as AstNode[]) {
      if (!el || el.type !== 'ObjectExpression') continue;
      const action = inputActionOf(getProp(el, 'inputAction'));
      if (!action) continue;
      config.buttons[action] = {
        hide: boolOf(getProp(el, 'hide')),
        icon: iconSrcOf(getProp(el, 'icon')),
      };
    }
  }
  return config;
}

function lineIndent(source: string, pos: number): string {
  const lineStart = source.lastIndexOf('\n', pos - 1) + 1;
  return source.slice(lineStart, pos).match(/^\s*/)?.[0] ?? '';
}

function findCallStatement(program: unknown, name: string): AstNode | null {
  return walk(program, node => {
    if (node.type !== 'ExpressionStatement') return false;
    const expr = node.expression;
    return (
      expr?.type === 'CallExpression' &&
      expr.callee?.type === 'Identifier' &&
      expr.callee.name === name
    );
  });
}

export function wireMobileHudEdits(program: { body?: AstNode[] }, source: string): Edit[] {
  const edits: Edit[] = [...ensureNamedImport(program, MOBILE_HUD_SETUP, MOBILE_HUD_IMPORT)];
  if (!new RegExp(`\\b${MOBILE_HUD_SETUP}\\s*\\(\\s*\\)`).test(source)) {
    const anchor = findCallStatement(program, 'setupUi');
    if (anchor) {
      const indent = lineIndent(source, anchor.start);
      edits.push({ start: anchor.end, end: anchor.end, text: `\n${indent}${MOBILE_HUD_SETUP}()` });
    } else {
      const at = afterImports(program);
      edits.push({ start: at, end: at, text: `${at === 0 ? '' : '\n'}${MOBILE_HUD_SETUP}()` });
    }
  }
  return edits;
}

function removeStatementLine(source: string, node: AstNode): Edit {
  const start = source.lastIndexOf('\n', node.start - 1) + 1;
  const end = source[node.end] === '\n' ? node.end + 1 : node.end;
  return { start, end, text: '' };
}

export function unwireMobileHudEdits(program: { body?: AstNode[] }, source: string): Edit[] {
  const edits: Edit[] = [];
  const imp = ((program.body ?? []) as AstNode[]).find(
    s => s.type === 'ImportDeclaration' && s.source?.value === MOBILE_HUD_IMPORT,
  );
  if (imp) edits.push(removeStatementLine(source, imp));
  const call = findCallStatement(program, MOBILE_HUD_SETUP);
  if (call) edits.push(removeStatementLine(source, call));
  return edits;
}
