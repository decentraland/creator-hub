import { isValidIdentifier } from '../../../lib/sdk/operations/validators';
import { store as reduxStore } from '../../../redux/store';
import { getPlatform } from '../../../redux/ui-designer';
import type { DeviceKind } from '../shared/safe-areas';
import { generateInteractionHelper, generatePlatformHelper } from './aggregator';
import { removeActionDecl, setActionBodyEdit, templateToBody, uiActionTypeEdit } from './actions';
import {
  addStateProperty,
  findStateNodes,
  removeStateProperty,
  setStatePropertyType,
  setStatePropertyValue,
} from './state-convention';
import {
  addPropsProperty,
  ensurePropsParamEdit,
  propTypeToTs,
  removePropsProperty,
  setPropsPropertyType,
} from './props-convention';
import {
  afterImports,
  type Edit,
  ensureNamedImport,
  raw,
  removeAttribute,
  setAttributeExpr,
  setAttributeSegments,
  segmentsFieldValue,
  setObjectFields,
  toBlockBody,
} from './emit-adapter';
import {
  addInteractionState,
  findInteractionForSpread,
  type InteractionAst,
  type InteractionStateKey,
  removeInteractionState,
  setInteractionActive,
  setInteractionFlat,
  setInteractionNested,
  soleSpreadArgument,
  unwrapInteractionEdits,
  wrapInInteractionEdits,
} from './interaction-convention';
import {
  addPlatformBranchEdits,
  branchElement,
  componentStatements,
  findPlatformConst,
  parsePlatformConditional,
  type PlatformVariantAst,
  unwrapPlatformEdits,
  wrapInPlatformEdits,
} from './platform-convention';
import { pbBackgroundPatchToErgoFields, pbToErgonomicText } from './ecs-shape';
import { boundTransformKeys, uiTransformPatchFields } from './transform-patch';
import { findComponentFn, isLayerableProp } from './parse-adapter';
import { coalesceRequiredAttr } from './required-attrs';
import type { CodeUINode } from './types';
import {
  applySourceEdits,
  callbackVars,
  lastComments,
  readFromDisk,
  state,
  UI_INTERACTION,
  UI_INTERACTION_IMPORT,
  UI_PLATFORM,
  UI_PLATFORM_IMPORT,
  writeToDisk,
} from './store-core';
import { astNodeFor, findCodeNode, guardElementWrite } from './store-nodes';
import { widgetJsx } from './store-splices';

export function interactionTargetFor(entityId: number, attrName: string): InteractionAst | null {
  const node = findCodeNode(state.parsed?.root, entityId);
  if (!node?.interaction || !isLayerableProp(node.type, attrName)) return null;
  return interactionAstFor(entityId);
}

export function styleObjectFor(
  componentId: string | undefined,
): 'uiTransform' | 'uiBackground' | null {
  if (componentId === 'core::UiTransform') return 'uiTransform';
  if (componentId === 'core::UiBackground') return 'uiBackground';
  return null;
}

export async function writeStyleKey(
  entityId: number,
  opName: string,
  objectName: 'uiTransform' | 'uiBackground',
  fields: Record<string, unknown>,
): Promise<void> {
  const ast = astNodeFor(entityId) as Parameters<typeof setObjectFields>[0] | undefined;
  if (!ast || !guardElementWrite(entityId, opName)) return;
  const interaction = interactionAstFor(entityId);
  const edits = interaction
    ? setInteractionNested(interaction, 'base', objectName, fields)
    : setObjectFields(ast, objectName, fields);
  if (edits.length) await applySourceEdits(edits);
}

export async function writeTransformBinding(
  entityId: number,
  opName: string,
  pbKey: string,
  expr: string | undefined,
): Promise<void> {
  const node = findCodeNode(state.parsed?.root, entityId);
  const current = (node?.uiTransform as Record<string, unknown>) ?? {};
  const bound = boundTransformKeys(node?.bindings);
  if (expr === undefined) delete bound[pbKey];
  else bound[pbKey] = expr;
  const fields = uiTransformPatchFields(
    current,
    { [pbKey]: undefined, [`${pbKey}Unit`]: undefined },
    bound,
  );
  await writeStyleKey(entityId, opName, 'uiTransform', fields);
}

export async function writeBackgroundBinding(
  entityId: number,
  opName: string,
  path: string,
  expr: string | undefined,
): Promise<void> {
  const dot = path.indexOf('.');
  if (dot < 0) {
    await writeStyleKey(entityId, opName, 'uiBackground', {
      [path]: expr === undefined ? undefined : raw(expr),
    });
    return;
  }
  const group = path.slice(0, dot);
  const member = path.slice(dot + 1);
  const node = findCodeNode(state.parsed?.root, entityId);
  const bg = (node?.uiBackground as Record<string, unknown>) ?? {};
  const fields = bg.texture ? pbBackgroundPatchToErgoFields({ texture: bg.texture }) : {};
  const existing = fields[group];
  const obj =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  if (expr === undefined) delete obj[member];
  else obj[member] = raw(expr);
  await writeStyleKey(entityId, opName, 'uiBackground', { ...fields, [group]: obj });
}

export async function bindAttributeUnlocked(
  entityId: number,
  name: string,
  expr: string,
  componentId?: string,
): Promise<void> {
  const objectName = styleObjectFor(componentId);
  if (objectName === 'uiTransform') {
    await writeTransformBinding(entityId, 'bindAttribute', name, expr);
    return;
  }
  if (objectName) {
    await writeBackgroundBinding(entityId, 'bindAttribute', name, expr);
    return;
  }
  const ast = astNodeFor(entityId) as Parameters<typeof setAttributeExpr>[0] | undefined;
  if (!ast) return;
  const node = findCodeNode(state.parsed?.root, entityId);
  const boundExpr = node ? coalesceRequiredAttr(node.type, name, expr) : expr;
  const interaction = interactionTargetFor(entityId, name);
  if (interaction) {
    await applySourceEdits(setInteractionFlat(interaction, 'base', { [name]: raw(boundExpr) }));
    return;
  }
  await applySourceEdits(setAttributeExpr(ast, name, boundExpr));
}

export async function unbindAttributeUnlocked(
  entityId: number,
  name: string,
  componentId?: string,
): Promise<void> {
  const objectName = styleObjectFor(componentId);
  if (objectName === 'uiTransform') {
    await writeTransformBinding(entityId, 'unbindAttribute', name, undefined);
    return;
  }
  if (objectName) {
    await writeBackgroundBinding(entityId, 'unbindAttribute', name, undefined);
    return;
  }
  const ast = astNodeFor(entityId) as Parameters<typeof removeAttribute>[0] | undefined;
  if (!ast) return;
  const interaction = interactionTargetFor(entityId, name);
  if (interaction) {
    await applySourceEdits(setInteractionFlat(interaction, 'base', { [name]: undefined }));
    return;
  }
  await applySourceEdits(removeAttribute(ast, state.source, name));
}

export async function setMixedContentAttributeUnlocked(
  entityId: number,
  name: string,
  segments: { kind: string; value: string }[],
): Promise<void> {
  const ast = astNodeFor(entityId) as Parameters<typeof setAttributeSegments>[0] | undefined;
  if (!ast) return;
  const interaction = interactionTargetFor(entityId, name);
  if (interaction) {
    await applySourceEdits(
      setInteractionFlat(interaction, 'base', { [name]: segmentsFieldValue(segments) }),
    );
    return;
  }
  if (segments.length === 1 && segments[0].kind === 'binding') {
    const node = findCodeNode(state.parsed?.root, entityId);
    const expr = node
      ? coalesceRequiredAttr(node.type, name, segments[0].value)
      : segments[0].value;
    await applySourceEdits(setAttributeExpr(ast, name, expr));
    return;
  }
  await applySourceEdits(setAttributeSegments(ast, name, segments));
}

export async function ensureInteractionHelper(): Promise<void> {
  if (await readFromDisk(UI_INTERACTION)) return;
  await writeToDisk(UI_INTERACTION, generateInteractionHelper());
}

export function interactionAstFor(entityId: number): InteractionAst | null {
  const el = astNodeFor(entityId) as Parameters<typeof soleSpreadArgument>[0] | undefined;
  if (!el || !state.program) return null;
  const fn = findComponentFn(
    state.program as Parameters<typeof findComponentFn>[0],
    activeComponentName(),
  );
  return findInteractionForSpread(
    soleSpreadArgument(el),
    fn as Parameters<typeof findInteractionForSpread>[1],
  );
}

export function uniqueLocalName(base: string, source: string): string {
  const safe = isValidIdentifier(base) ? base : 'interactionStyles';
  let name = safe;
  for (let i = 1; new RegExp(`\\b${name}\\b`).test(source); i++) name = `${safe}${i}`;
  return name;
}

export async function addInteractionStatesUnlocked(entityId: number): Promise<void> {
  const node = findCodeNode(state.parsed?.root, entityId);
  if (!node || node.interaction) return;
  if (!guardElementWrite(entityId, 'addInteractionStates')) return;
  if (!state.program) return;

  await ensureInteractionHelper();

  const componentName = activeComponentName();
  const initialFn = findComponentFn(
    state.program as Parameters<typeof findComponentFn>[0],
    componentName,
  );
  if (!initialFn) return;
  const toBlock = toBlockBody(initialFn as Parameters<typeof toBlockBody>[0], state.source);
  if (toBlock.length) await applySourceEdits(toBlock);

  const el = astNodeFor(entityId) as Record<string, any> | undefined;
  const fn = findComponentFn(state.program as Parameters<typeof findComponentFn>[0], componentName);
  if (!el || !fn) return;

  await applySourceEdits(
    wrapInInteractionEdits({
      program: state.program as Parameters<typeof wrapInInteractionEdits>[0]['program'],
      fnNode: fn as Parameters<typeof wrapInInteractionEdits>[0]['fnNode'],
      el: el as Parameters<typeof wrapInInteractionEdits>[0]['el'],
      source: state.source,
      name: uniqueLocalName(
        `${node.type.charAt(0).toLowerCase()}${node.type.slice(1)}Styles`,
        state.source,
      ),
      importFrom: UI_INTERACTION_IMPORT,
      isLayerable: attrName => isLayerableProp(node.type, attrName),
    }),
  );
}

export async function removeInteractionStatesUnlocked(entityId: number): Promise<void> {
  const ast = interactionAstFor(entityId);
  const el = astNodeFor(entityId) as Parameters<typeof unwrapInteractionEdits>[1] | undefined;
  if (!ast || !el) return;
  const edits = unwrapInteractionEdits(ast, el, state.source);
  if (edits.length) await applySourceEdits(edits);
}

export async function setInteractionFieldUnlocked(
  entityId: number,
  stateKey: InteractionStateKey,
  componentId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const ast = interactionAstFor(entityId);
  const node = findCodeNode(state.parsed?.root, entityId);
  if (!ast || !node) return;

  let edits: Edit[] = [];
  if (componentId === 'core::UiTransform') {
    const current = (node.interaction?.states[stateKey]?.uiTransform ?? {}) as Record<
      string,
      unknown
    >;
    const fields = uiTransformPatchFields(current, patch, boundTransformKeys(node.bindings));
    if (Object.keys(fields).length)
      edits = setInteractionNested(ast, stateKey, 'uiTransform', fields);
  } else if (componentId === 'core::UiBackground') {
    const fields = pbBackgroundPatchToErgoFields(patch);
    if (Object.keys(fields).length)
      edits = setInteractionNested(ast, stateKey, 'uiBackground', fields);
  } else if (
    componentId === 'core::UiText' ||
    componentId === 'core::UiInput' ||
    componentId === 'core::UiDropdown'
  ) {
    edits = setInteractionFlat(ast, stateKey, pbToErgonomicText(patch));
  }
  if (edits.length) await applySourceEdits(edits);
}

export async function addInteractionLayerUnlocked(
  entityId: number,
  stateKey: InteractionStateKey,
): Promise<void> {
  const ast = interactionAstFor(entityId);
  if (!ast) return;
  const edits = addInteractionState(ast, stateKey);
  if (edits.length) await applySourceEdits(edits);
}

export async function removeInteractionLayerUnlocked(
  entityId: number,
  stateKey: InteractionStateKey,
): Promise<void> {
  const ast = interactionAstFor(entityId);
  if (!ast) return;
  const edits = removeInteractionState(ast, stateKey);
  if (edits.length) await applySourceEdits(edits);
}

export async function setInteractionActiveBindingUnlocked(
  entityId: number,
  expr: string | undefined,
): Promise<void> {
  const ast = interactionAstFor(entityId);
  if (!ast) return;
  const edits = setInteractionActive(ast, expr);
  if (edits.length) await applySourceEdits(edits);
}

export async function ensurePlatformHelper(): Promise<void> {
  if (await readFromDisk(UI_PLATFORM)) return;
  await writeToDisk(UI_PLATFORM, generatePlatformHelper());
}

export function activePlatform(): DeviceKind {
  return getPlatform(reduxStore.getState() as never);
}

export function platformStatements(): Parameters<typeof findPlatformConst>[0] {
  if (!state.program) return [];
  const fn = findComponentFn(
    state.program as Parameters<typeof findComponentFn>[0],
    activeComponentName(),
  );
  return componentStatements(fn as Parameters<typeof componentStatements>[0]);
}

export function platformAstFor(entityId: number): PlatformVariantAst | null {
  const node = astNodeFor(entityId) as Parameters<typeof parsePlatformConditional>[0] | undefined;
  if (!node) return null;
  return parsePlatformConditional(node, platformStatements());
}

export function platformVariantOf(
  entityId: number,
): { variant: CodeUINode; branch?: CodeUINode } | null {
  const root = state.parsed?.root;
  if (!root) return null;
  const node = findCodeNode(root, entityId);
  if (node?.platformVariant) return { variant: node };
  if (!node?.platform) return null;
  const search = (n: CodeUINode): CodeUINode | null => {
    if (n.platformVariant && n.children.includes(node)) return n;
    for (const child of n.children) {
      const found = search(child);
      if (found) return found;
    }
    return null;
  };
  const variant = search(root);
  return variant ? { variant, branch: node } : null;
}

export function guardPlatformBranch(entityId: number, opName: string): boolean {
  if (!findCodeNode(state.parsed?.root, entityId)?.platform) return true;
  console.warn(`[code-mode] ${opName}: a platform branch can't be moved out of its variant`);
  return false;
}

export async function addPlatformVariantUnlocked(entityId: number): Promise<void> {
  const node = findCodeNode(state.parsed?.root, entityId);
  if (!node || node.platform || node.platformVariant) return;
  if (!state.program) return;

  await ensurePlatformHelper();

  const componentName = activeComponentName();
  const initialFn = findComponentFn(
    state.program as Parameters<typeof findComponentFn>[0],
    componentName,
  );
  if (!initialFn) return;
  const toBlock = toBlockBody(initialFn as Parameters<typeof toBlockBody>[0], state.source);
  if (toBlock.length) await applySourceEdits(toBlock);

  const el = astNodeFor(entityId) as Record<string, any> | undefined;
  const fn = findComponentFn(state.program as Parameters<typeof findComponentFn>[0], componentName);
  if (!el || !fn) return;
  const existing = findPlatformConst(platformStatements());

  await applySourceEdits([
    ...wrapInPlatformEdits({
      program: state.program as Parameters<typeof wrapInPlatformEdits>[0]['program'],
      fnNode: fn as Parameters<typeof wrapInPlatformEdits>[0]['fnNode'],
      el: el as Parameters<typeof wrapInPlatformEdits>[0]['el'],
      source: state.source,
      varName: existing?.name ?? uniqueLocalName('platform', state.source),
      declare: !existing,
      importFrom: UI_PLATFORM_IMPORT,
      seedJsx: widgetJsx('UiEntity'),
      braced: entityId !== (state.parsed?.root.entity as unknown as number),
    }),
    ...ensureNamedImport(state.program as any, 'UiEntity', '@dcl/sdk/react-ecs'),
  ]);
}

export async function addPlatformBranchUnlocked(
  entityId: number,
  platform: DeviceKind,
): Promise<void> {
  const variant = platformVariantOf(entityId)?.variant;
  if (!variant || !state.program) return;
  const ast = platformAstFor(variant.entity as unknown as number);
  if (!ast) return;
  const edits = addPlatformBranchEdits(ast, platform, widgetJsx('UiEntity'));
  if (!edits.length) return;
  await applySourceEdits([
    ...edits,
    ...ensureNamedImport(state.program as any, 'UiEntity', '@dcl/sdk/react-ecs'),
  ]);
}

export async function removePlatformVariantUnlocked(
  entityId: number,
  keepDevice?: DeviceKind,
): Promise<void> {
  const found = platformVariantOf(entityId);
  if (!found) return;
  const ast = platformAstFor(found.variant.entity as unknown as number);
  if (!ast) return;
  const wanted: DeviceKind =
    keepDevice ??
    (found.branch ? (found.branch.platform === 'mobile' ? 'desktop' : 'mobile') : activePlatform());
  const keep = branchElement(ast[wanted])
    ? wanted
    : branchElement(ast.desktop)
      ? 'desktop'
      : 'mobile';
  const edits = unwrapPlatformEdits(ast, keep, state.source);
  if (edits.length) await applySourceEdits(edits);
}

/** Whether each device branch of a platform variant currently holds an element. */
export function platformBranchesWithContent(entityId: number): {
  desktop: boolean;
  mobile: boolean;
} {
  const found = platformVariantOf(entityId);
  if (!found) return { desktop: false, mobile: false };
  const ast = platformAstFor(found.variant.entity as unknown as number);
  if (!ast) return { desktop: false, mobile: false };
  return { desktop: !!branchElement(ast.desktop), mobile: !!branchElement(ast.mobile) };
}

export async function ensureStateScaffold(): Promise<void> {
  if (!state.program) return;
  if (findStateNodes(state.program as any).object) return;
  const at = afterImports(state.program as any);
  await applySourceEdits([
    { start: at, end: at, text: '\n\nexport interface State {}\nexport const state: State = {}' },
  ]);
}

export async function addBindVariableUnlocked(
  name: string,
  type: string,
  rawDefault?: string,
): Promise<void> {
  await ensureStateScaffold();
  if (!state.program) return;
  const edits = addStateProperty(state.program as any, name, type, rawDefault);
  if (edits.length) await applySourceEdits(edits);
}

export async function setStateVariableValueUnlocked(
  name: string,
  type: string,
  rawDefault: string,
): Promise<void> {
  if (!state.program) return;
  const edits = setStatePropertyValue(state.program as any, name, type, rawDefault);
  if (edits.length) await applySourceEdits(edits);
}

export async function ensureUiActionScaffold(): Promise<void> {
  if (!state.program) return;
  const cn = activeComponentName();
  if (!cn) return;
  const edits: Edit[] = [];
  const propsEdit = ensurePropsParamEdit(state.program as any, state.source, cn);
  if (propsEdit) edits.push(propsEdit);
  const typeEdit = uiActionTypeEdit(state.program as any, cn);
  if (typeEdit) edits.push(typeEdit);
  if (edits.length) await applySourceEdits(edits);
}

export async function addBindActionUnlocked(name: string): Promise<void> {
  await ensureStateScaffold();
  await ensureUiActionScaffold();
  if (!state.program) return;
  const at = afterImports(state.program as any);
  await applySourceEdits([
    {
      start: at,
      end: at,
      text: `\n\n/** @ui-action */\nfunction ${name}({ state, props, value }: UiAction) {}`,
    },
  ]);
}

export async function removeActionUnlocked(name: string): Promise<void> {
  if (!state.program) return;
  const edits = removeActionDecl(state.program as any, name, lastComments as any, state.source);
  if (edits.length) await applySourceEdits(edits);
}

export async function setActionBodyUnlocked(name: string, template: string): Promise<void> {
  if (!state.program) return;
  const code = templateToBody(template, callbackVars(state.bindingSurface.variables));
  const edits = setActionBodyEdit(state.program as any, name, code);
  if (edits.length) await applySourceEdits(edits);
}

export async function removeStateVariableUnlocked(name: string): Promise<void> {
  if (!state.program) return;
  const edits = removeStateProperty(state.program as any, name);
  if (edits.length) await applySourceEdits(edits);
}

export async function retypeStateVariableUnlocked(name: string, type: string): Promise<void> {
  if (!state.program) return;
  const edits = setStatePropertyType(state.program as any, name, type);
  if (edits.length) await applySourceEdits(edits);
}

export function activeComponentName(): string | undefined {
  return state.roots.find(r => r.filename === state.filename)?.name;
}

export async function addBindPropUnlocked(name: string, type: string): Promise<void> {
  const cn = activeComponentName();
  if (!state.program || !cn) return;
  const edits = addPropsProperty(state.program as any, state.source, cn, name, propTypeToTs(type));
  if (edits.length) await applySourceEdits(edits);
}

export async function removePropUnlocked(name: string): Promise<void> {
  const cn = activeComponentName();
  if (!state.program || !cn) return;
  const edits = removePropsProperty(state.program as any, cn, name);
  if (edits.length) await applySourceEdits(edits);
}

export async function retypePropUnlocked(name: string, type: string): Promise<void> {
  const cn = activeComponentName();
  if (!state.program || !cn) return;
  const edits = setPropsPropertyType(state.program as any, cn, name, propTypeToTs(type));
  if (edits.length) await applySourceEdits(edits);
}
