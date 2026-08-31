import type { Entity } from '@dcl/ecs';
import { getCodeParser } from '../../../lib/logic/code-parser';
import { store as reduxStore } from '../../../redux/store';
import { selectNode } from '../../../redux/ui-designer';
import { dragPinPatch } from '../shared/align-presets';
import { type UINodeType, type WidgetKind, type WidgetPreset } from '../shared/tree-model';
import { type UiScreenInset } from './aggregator';
import { nodeNameEdit, renumberNodeNames, sanitizeNodeName, withNodeName } from './name-marker';
import { collectComponentRefNames, wouldCycle } from './component-graph';
import { componentMarkerEdit } from './component-marker';
import {
  applyEdits,
  type Edit,
  ensureNamedImport,
  insertChild,
  insertSibling,
  moveElement,
  removeAttribute,
  removeNode,
  removeNodes,
  removeReturnJsx,
  setAttribute,
  setAttributes,
  setObjectFields,
  setReturnJsx,
} from './emit-adapter';
import { setInteractionNested } from './interaction-convention';
import { pbBackgroundPatchToErgoFields, pbToErgonomicButton, pbToErgonomicText } from './ecs-shape';
import {
  boundTransformKeys,
  uiTransformPatchEdits,
  uiTransformPatchFields,
} from './transform-patch';
import { findComponentFn, UI_BUTTON } from './parse-adapter';
import { uniqueName } from './root-naming';
import {
  applySourceEdits,
  duplicateRootUnlocked,
  formatActiveFile,
  loadAndParse,
  pushUndoSnapshot,
  readFromDisk,
  regenerateAggregator,
  set,
  state,
  writeToDisk,
} from './store-core';
import { astNodeFor, collectNodeLabels, findCodeNode, guardElementWrite } from './store-nodes';
import {
  activeComponentName,
  guardPlatformBranch,
  interactionAstFor,
  removePlatformVariantUnlocked,
} from './store-bindings';

export async function spliceComponentPatchUnlocked(
  entityId: number,
  componentId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const ast = astNodeFor(entityId) as Parameters<typeof setObjectFields>[0] | undefined;
  if (!ast) return;
  const edits: Edit[] = [];

  if (componentId === 'core::UiTransform') {
    if (!guardElementWrite(entityId, 'spliceComponentPatch')) return;
    const node = findCodeNode(state.parsed?.root, entityId);
    const current = (node?.uiTransform as Record<string, unknown>) ?? {};
    edits.push(...uiTransformPatchEdits(ast, current, patch, boundTransformKeys(node?.bindings)));
  } else if (componentId === 'core::UiBackground') {
    if (!guardElementWrite(entityId, 'spliceComponentPatch')) return;
    const fields = pbBackgroundPatchToErgoFields(patch);
    if (Object.keys(fields).length) edits.push(...setObjectFields(ast, 'uiBackground', fields));
  } else if (
    componentId === 'core::UiText' ||
    componentId === 'core::UiInput' ||
    componentId === 'core::UiDropdown' ||
    componentId === UI_BUTTON
  ) {
    const ergo = componentId === UI_BUTTON ? pbToErgonomicButton(patch) : pbToErgonomicText(patch);
    edits.push(...setAttributes(ast, state.source, ergo));
  }

  if (edits.length) await applySourceEdits(edits);
}

export async function writeUiTransformFields(
  entityId: number,
  opName: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const ast = astNodeFor(entityId) as Parameters<typeof setObjectFields>[0] | undefined;
  if (!ast || !guardElementWrite(entityId, opName)) return;
  const interaction = interactionAstFor(entityId);
  const edits = interaction
    ? setInteractionNested(interaction, 'base', 'uiTransform', fields)
    : setObjectFields(ast, 'uiTransform', fields);
  if (edits.length) await applySourceEdits(edits);
}

export function dropPinFields(
  entityId: number,
  top: number,
  left: number,
): Record<string, unknown> {
  const node = findCodeNode(state.parsed?.root, entityId);
  const current = (node?.uiTransform as Record<string, unknown>) ?? {};
  return uiTransformPatchFields(
    current,
    dragPinPatch(top, left, current),
    boundTransformKeys(node?.bindings),
  );
}

export async function spliceUiTransformPositionUnlocked(
  entityId: number,
  top: number,
  left: number,
): Promise<void> {
  await writeUiTransformFields(
    entityId,
    'spliceUiTransformPosition',
    dropPinFields(entityId, top, left),
  );
}

export async function spliceUiTransformPositionsUnlocked(
  moves: { entityId: number; top: number; left: number }[],
): Promise<void> {
  const edits: Edit[] = [];
  for (const { entityId, top, left } of moves) {
    const ast = astNodeFor(entityId) as Parameters<typeof setObjectFields>[0] | undefined;
    if (!ast || !guardElementWrite(entityId, 'spliceUiTransformPositions')) continue;
    const interaction = interactionAstFor(entityId);
    const fields = dropPinFields(entityId, top, left);
    edits.push(
      ...(interaction
        ? setInteractionNested(interaction, 'base', 'uiTransform', fields)
        : setObjectFields(ast, 'uiTransform', fields)),
    );
  }
  if (edits.length) await applySourceEdits(edits);
}

export async function spliceUiTransformResizeUnlocked(
  entityId: number,
  opts: {
    position?: { top: number; left: number };
    margin?: { top: number; left: number };
    width: number;
    height: number;
  },
): Promise<void> {
  const fields: Record<string, unknown> = { width: opts.width, height: opts.height };
  if (opts.position) {
    Object.assign(fields, dropPinFields(entityId, opts.position.top, opts.position.left));
  }
  if (opts.margin) fields.margin = opts.margin;
  await writeUiTransformFields(entityId, 'spliceUiTransformResize', fields);
}

export const CHILD_TEMPLATES: Record<UINodeType, string> = {
  UiEntity:
    '<UiEntity uiTransform={{ width: 200, height: 100 }} uiBackground={{ color: { r: 1, g: 1, b: 1, a: 0.1 } }} />',
  Label: '<Label value="Label" fontSize={24} uiTransform={{ width: 200, height: 36 }} />',
  Button: '<Button value="Button" fontSize={18} uiTransform={{ width: 160, height: 44 }} />',
  Input: '<Input placeholder="Type here" fontSize={18} uiTransform={{ width: 240, height: 44 }} />',
  Dropdown:
    "<Dropdown options={['Option 1', 'Option 2']} fontSize={18} uiTransform={{ width: 240, height: 44 }} />",
};

export const IMAGE_TEMPLATE =
  "<UiEntity uiTransform={{ width: 200, height: 200 }} uiBackground={{ color: { r: 1, g: 1, b: 1, a: 1 }, textureMode: 'center' }} />";

export const FULLSCREEN_TEMPLATE =
  "<UiEntity uiTransform={{ flexGrow: 1, alignSelf: 'stretch' }} uiBackground={{ color: { r: 1, g: 1, b: 1, a: 0.1 } }} />";

export function widgetJsx(type: UINodeType, preset?: WidgetPreset, named = true): string {
  const jsx =
    preset === 'image'
      ? IMAGE_TEMPLATE
      : preset === 'fullscreen'
        ? FULLSCREEN_TEMPLATE
        : (CHILD_TEMPLATES[type] ?? CHILD_TEMPLATES.UiEntity);
  if (!named) return jsx;
  const kind: WidgetKind = preset === 'image' ? 'Image' : type === 'UiEntity' ? 'Container' : type;
  return withNodeName(jsx, uniqueName(kind, collectNodeLabels(state.parsed?.root)));
}

export async function spliceAddChildUnlocked(
  parentEntityId: number,
  type: UINodeType,
  preset?: WidgetPreset,
): Promise<void> {
  const ast = astNodeFor(parentEntityId) as Parameters<typeof insertChild>[0] | undefined;
  if (!ast || !guardElementWrite(parentEntityId, 'spliceAddChild')) return;
  const jsx = widgetJsx(type, preset);
  const edits = [...insertChild(ast, state.source, jsx)];
  if (state.program) {
    edits.push(...ensureNamedImport(state.program as any, type, '@dcl/sdk/react-ecs'));
  }
  await applySourceEdits(edits);
}

export async function spliceAddWidgetUnlocked(
  anchorEntityId: number,
  dropType: 'before' | 'after' | 'inside',
  type: UINodeType,
  preset?: WidgetPreset,
): Promise<void> {
  const ast = astNodeFor(anchorEntityId) as Parameters<typeof insertChild>[0] | undefined;
  if (!ast || !state.program) return;
  const jsx = widgetJsx(type, preset);
  let edits: Edit[];
  if (dropType === 'inside') {
    if (!guardElementWrite(anchorEntityId, 'spliceAddWidget')) return;
    edits = [...insertChild(ast, state.source, jsx)];
  } else {
    edits = [...insertSibling(ast, state.source, jsx, dropType)];
  }
  edits.push(...ensureNamedImport(state.program as any, type, '@dcl/sdk/react-ecs'));
  await applySourceEdits(edits);
}

export async function spliceSetRootChildUnlocked(
  type: UINodeType,
  preset?: WidgetPreset,
): Promise<void> {
  if (!state.program || !state.filename) return;
  const activeName = state.roots.find(r => r.filename === state.filename)?.name;
  if (!activeName) return;
  const fn = findComponentFn(state.program as Parameters<typeof findComponentFn>[0], activeName);
  if (!fn) return;
  const jsx = widgetJsx(type, preset, false);
  const edits = [
    ...setReturnJsx(fn as Parameters<typeof setReturnJsx>[0], state.source, jsx),
    ...ensureNamedImport(state.program as any, type, '@dcl/sdk/react-ecs'),
  ];
  await applySourceEdits(edits);
}

export async function buildReferenceGraph(): Promise<Map<string, string[]>> {
  const parser = getCodeParser();
  const known = new Set(state.roots.map(r => r.name));
  const graph = new Map<string, string[]>();
  if (!parser) return graph;
  for (const root of state.roots) {
    const source =
      root.filename === state.filename ? state.source : await readFromDisk(root.filename);
    if (!source) {
      graph.set(root.name, []);
      continue;
    }
    try {
      const result = await parser.parse(root.filename, source);
      if (result.errors && result.errors.length > 0) graph.set(root.name, []);
      else graph.set(root.name, collectComponentRefNames(result.program as any, known));
    } catch {
      graph.set(root.name, []);
    }
  }
  return graph;
}

export async function canNest(parentRootName: string, childName: string): Promise<boolean> {
  if (parentRootName === childName) return false;
  const refs = await buildReferenceGraph();
  return !wouldCycle(refs, parentRootName, childName);
}

export async function spliceInsertComponentUnlocked(
  parentEntityId: number,
  componentName: string,
): Promise<void> {
  const ast = astNodeFor(parentEntityId) as Parameters<typeof insertChild>[0] | undefined;
  if (!ast || !state.program || !state.filename) return;
  const activeName = activeComponentName();
  if (activeName && !(await canNest(activeName, componentName))) {
    console.warn('[code-mode] refused to nest', componentName, '(would create a cycle)');
    return;
  }
  const childJsx = `<UiEntity uiTransform={{ width: 200, height: 120 }}>\n  <${componentName} />\n</UiEntity>`;
  const edits = [
    ...insertChild(ast, state.source, childJsx),
    ...ensureNamedImport(state.program as any, componentName, `./${componentName}`),
  ];
  await applySourceEdits(edits);
}

export async function spliceInstancePropUnlocked(
  entityId: number,
  name: string,
  type: string,
  rawValue: string,
): Promise<void> {
  const ast = astNodeFor(entityId) as Parameters<typeof setAttribute>[0] | undefined;
  if (!ast) return;
  if (type !== 'string' && type !== 'number' && type !== 'boolean') {
    console.warn(`[code-mode] prop "${name}" has a non-primitive type — edit it in code`);
    return;
  }
  const value: string | number | boolean =
    type === 'number'
      ? Number.isFinite(Number(rawValue))
        ? Number(rawValue)
        : 0
      : type === 'boolean'
        ? rawValue === 'true'
        : rawValue;
  await applySourceEdits(setAttribute(ast, name, value));
}

export async function unsetInstancePropUnlocked(entityId: number, name: string): Promise<void> {
  const ast = astNodeFor(entityId) as Parameters<typeof removeAttribute>[0] | undefined;
  if (!ast) return;
  await applySourceEdits(removeAttribute(ast, state.source, name));
}

export async function toggleTopLevelUnlocked(filename: string): Promise<void> {
  const root = state.roots.find(r => r.filename === filename);
  if (!root) return;
  const newTopLevel = !root.topLevel;
  const isActive = filename === state.filename;
  const source = isActive ? state.source : await readFromDisk(filename);
  if (!source) return;
  const parser = getCodeParser();
  if (!parser) return;
  const result = await parser.parse(filename, source);
  const edits = componentMarkerEdit(
    result.program as any,
    result.comments as any,
    source,
    root.name,
    !newTopLevel,
  );
  if (edits.length) {
    const next = applyEdits(source, edits);
    if (isActive) {
      pushUndoSnapshot(filename, source);
      await loadAndParse(filename, next);
    } else {
      await writeToDisk(filename, next);
    }
  }
  const roots = state.roots.map(r =>
    r.filename === filename ? { ...r, topLevel: newTopLevel } : r,
  );
  set({ roots });
  await regenerateAggregator(roots);
}

export async function setRootScreenInsetUnlocked(
  filename: string,
  inset: UiScreenInset,
): Promise<void> {
  const root = state.roots.find(r => r.filename === filename);
  if (!root || root.screenInset === inset) return;
  const roots = state.roots.map(r => (r.filename === filename ? { ...r, screenInset: inset } : r));
  set({ roots });
  await regenerateAggregator(roots);
}

export async function spliceRemoveNodeUnlocked(entityId: number): Promise<void> {
  const node = findCodeNode(state.parsed?.root, entityId);
  if (node?.platformVariant || node?.platform) {
    await removePlatformVariantUnlocked(entityId);
    return;
  }
  if (node && node === state.parsed?.root) {
    const activeName = state.roots.find(r => r.filename === state.filename)?.name;
    const fn = activeName
      ? findComponentFn(state.program as Parameters<typeof findComponentFn>[0], activeName)
      : null;
    if (!fn) return;
    await applySourceEdits(removeReturnJsx(fn as Parameters<typeof removeReturnJsx>[0]));
    return;
  }
  const ast = astNodeFor(entityId) as Parameters<typeof removeNode>[0] | undefined;
  if (!ast) return;
  await applySourceEdits(removeNode(ast));
}

export async function spliceRemoveNodesUnlocked(entityIds: number[]): Promise<void> {
  if (entityIds.length === 1) return spliceRemoveNodeUnlocked(entityIds[0]);
  const root = state.parsed?.root;
  if (!root) return;
  if (entityIds.some(id => (root.entity as unknown as number) === id)) {
    return spliceRemoveNodeUnlocked(root.entity as unknown as number);
  }
  const asts: Parameters<typeof removeNodes>[0] = [];
  for (const id of entityIds) {
    const node = findCodeNode(root, id);
    if (node?.platformVariant || node?.platform) {
      console.warn('[code-mode] platform variant in multi-delete skipped — delete it on its own');
      continue;
    }
    const ast = astNodeFor(id) as Parameters<typeof removeNode>[0] | undefined;
    if (ast) asts.push(ast);
  }
  if (asts.length > 0) await applySourceEdits(removeNodes(asts));
}

export type MoveAnchor = { kind: 'after' | 'before' | 'into'; targetId: number };

export async function spliceMoveUnlocked(entityId: number, anchor: MoveAnchor): Promise<void> {
  const el = astNodeFor(entityId) as
    | (Parameters<typeof removeNode>[0] & Record<string, any>)
    | undefined;
  const target = astNodeFor(anchor.targetId) as
    | (Parameters<typeof insertChild>[0] & Record<string, any>)
    | undefined;
  if (!el || !target || anchor.targetId === entityId) return;
  if (target.start >= el.start && target.end <= el.end) return;
  if (!guardPlatformBranch(entityId, 'spliceMove')) return;
  if (!guardPlatformBranch(anchor.targetId, 'spliceMove')) return;
  if (anchor.kind === 'into') {
    const targetNode = findCodeNode(state.parsed?.root, anchor.targetId);
    if (targetNode?.componentRef) {
      console.warn('[code-mode] cannot nest children inside a component instance');
      return;
    }
    if (targetNode?.platformVariant) {
      console.warn('[code-mode] cannot nest children inside a platform variant');
      return;
    }
  }

  const elLen = el.end - el.start;
  let expectedStart: number;
  let edits: Edit[];
  if (anchor.kind === 'into') {
    const raw = state.source.slice(el.start, el.end);
    edits = [...removeNode(el), ...insertChild(target, state.source, raw)];
    const closing = target.closingElement as { start: number } | undefined;
    if (closing) {
      const at = closing.start;
      expectedStart = el.end <= at ? at - elLen : at;
    } else {
      const open = target.openingElement as { end: number };
      const slashGt = state.source.lastIndexOf('/>', open.end);
      const at = slashGt >= 0 ? slashGt : open.end - 2;
      expectedStart = (el.end <= at ? at - elLen : at) + '>\n  '.length;
    }
  } else {
    const insertAt = anchor.kind === 'after' ? target.end : target.start;
    edits = moveElement(state.source, el, insertAt);
    expectedStart = insertAt >= el.end ? insertAt - elLen + 1 : insertAt;
  }
  await applySourceEdits(edits, { format: false });

  const spans = state.parsed?.spans;
  if (spans) {
    for (const [id, span] of spans) {
      if (span[0] === expectedStart) {
        reduxStore.dispatch(selectNode({ node: id as unknown as Entity }));
        break;
      }
    }
  }
  await formatActiveFile();
}

export async function spliceDuplicateUnlocked(entityId: number): Promise<number | null> {
  if (!guardPlatformBranch(entityId, 'spliceDuplicate')) return null;
  if (state.parsed && findCodeNode(state.parsed.root, entityId) === state.parsed.root) {
    if (state.filename) await duplicateRootUnlocked(state.filename);
    return null;
  }
  const el = astNodeFor(entityId) as Parameters<typeof removeNode>[0] | undefined;
  if (!el) return null;
  const raw = renumberNodeNames(
    state.source.slice(el.start, el.end),
    collectNodeLabels(state.parsed?.root),
  );
  const cloneStart = el.end + 1;
  await applySourceEdits([{ start: el.end, end: el.end, text: `\n${raw}` }], { format: false });
  const spans = state.parsed?.spans;
  if (!spans) return null;
  let cloneId: number | null = null;
  for (const [id, span] of spans) {
    if (span[0] === cloneStart) {
      cloneId = id;
      break;
    }
  }
  if (cloneId !== null) reduxStore.dispatch(selectNode({ node: cloneId as unknown as Entity }));
  await formatActiveFile();
  return cloneId;
}

export async function spliceRenameNodeUnlocked(entityId: number, desired: string): Promise<void> {
  const node = findCodeNode(state.parsed?.root, entityId);
  if (!node || node.opaque || node.componentRef || node.platformVariant || node.platform) return;
  const el = astNodeFor(entityId) as Parameters<typeof nodeNameEdit>[0] | undefined;
  if (!el) return;
  const clean = sanitizeNodeName(desired);
  const name = clean ? uniqueName(clean, collectNodeLabels(state.parsed?.root, entityId)) : '';
  const edits = nodeNameEdit(el, state.source, name);
  if (edits.length) await applySourceEdits(edits);
}
