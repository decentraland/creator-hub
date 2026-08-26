import { useSyncExternalStore } from 'react';
import type { Entity } from '@dcl/ecs';

import { getCodeParser } from '../../../lib/logic/code-parser';
import { markLocalEdit } from '../../../lib/logic/local-edit';
import { isValidIdentifier } from '../../../lib/sdk/operations/validators';
import { getStorage } from '../../../lib/data-layer/client/storage';
import { store as reduxStore } from '../../../redux/store';
import {
  getPlatform,
  getSelectedNodes,
  remapNodeIds,
  resetNodeState,
  selectNode,
  selectNodes,
} from '../../../redux/ui-designer';
import { dragPinPatch } from '../shared/align-presets';
import type { DeviceKind } from '../shared/safe-areas';
import { nodeLabelText, type UINodeType, type WidgetKind } from '../shared/tree-model';
import {
  DEFAULT_SCREEN_INSET,
  generateInteractionHelper,
  generatePlatformHelper,
  generateRootComponent,
  generateUiIndex,
  readRootInsets,
  type UiScreenInset,
} from './aggregator';
import {
  type CodeAction,
  migrateActionsToArgsObject,
  readActions,
  removeActionDecl,
  setActionBodyEdit,
  templateToBody,
  uiActionTypeEdit,
} from './actions';
import {
  type BindingSurface,
  type BindVariable,
  buildResolveMap,
  extractBindingSurface,
} from './bindings';
import { collectNamedImports, resolveModuleCandidates } from './imports';
import { nodeNameEdit, renumberNodeNames, sanitizeNodeName, withNodeName } from './name-marker';
import {
  addStateProperty,
  findStateNodes,
  readStateVariables,
  removeStateProperty,
  setStatePropertyType,
  setStatePropertyValue,
} from './state-convention';
import {
  addPropsProperty,
  ensurePropsParamEdit,
  propTypeToTs,
  type PropVar,
  readPropsVariables,
  removePropsProperty,
  setPropsPropertyType,
} from './props-convention';
import {
  collectComponentRefNames,
  referencesRoot,
  renameComponentRefEdits,
  wouldCycle,
} from './component-graph';
import { componentMarkerEdit, hasComponentMarker } from './component-marker';
import {
  afterImports,
  applyEdits,
  type Edit,
  ensureNamedImport,
  insertChild,
  insertSibling,
  raw,
  moveElement,
  removeAttribute,
  removeNode,
  removeNodes,
  removeReturnJsx,
  setAttribute,
  setAttributeExpr,
  setAttributes,
  setAttributeSegments,
  segmentsFieldValue,
  setObjectFields,
  setReturnJsx,
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
import { pbBackgroundPatchToErgoFields, pbToErgonomicButton, pbToErgonomicText } from './ecs-shape';
import { formatUiSource } from './formatting';
import {
  boundTransformKeys,
  uiTransformPatchEdits,
  uiTransformPatchFields,
} from './transform-patch';
import {
  codeToUINodes,
  findComponentFn,
  findComponentIdSpan,
  isLayerableComponent,
  isLayerableProp,
  UI_BUTTON,
} from './parse-adapter';
import { toComponentName, uniqueName } from './root-naming';
import type { CodeUINode, InteractionStateStyles, ParsedUI } from './types';

/** One UI root = one component file under src/ui/. */
export interface CodeRoot {
  name: string;
  filename: string;
  topLevel: boolean;
  screenInset: UiScreenInset;
}

export interface ResolvedComponent {
  parsed: ParsedUI | null;
  resolveMap: Record<string, string>;
  props: PropVar[];
}

export interface CodeState {
  filename: string | null;
  source: string;
  parsed: ParsedUI | null;
  roots: CodeRoot[];
  componentTrees: Record<string, ResolvedComponent | null>;
  bindingSurface: BindingSurface;
  actions: CodeAction[];
  program: unknown;
  error: string | null;
  emptyRoot: boolean;
  parsing: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

let state: CodeState = {
  filename: null,
  source: '',
  parsed: null,
  roots: [],
  componentTrees: {},
  bindingSurface: { variables: [], actions: [] },
  actions: [],
  program: undefined,
  error: null,
  emptyRoot: false,
  parsing: false,
  canUndo: false,
  canRedo: false,
};

const listeners = new Set<() => void>();

let lastComments: unknown[] = [];

function set(next: Partial<CodeState>) {
  state = { ...state, ...next };
  for (const l of listeners) l();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): CodeState {
  return state;
}

export function useCodeState(): CodeState {
  return useSyncExternalStore(subscribe, getSnapshot);
}

const UI_DIR = 'src/ui';
const UI_INDEX = 'src/ui/index.tsx';
const UI_INTERACTION = 'src/ui/interaction.tsx';
const UI_INTERACTION_IMPORT = './interaction';
const UI_PLATFORM = 'src/ui/platform.tsx';
const UI_PLATFORM_IMPORT = './platform';
const UI_HELPERS = new Set([UI_INTERACTION, UI_PLATFORM]);
const SCENE_ENTRY = 'src/index.ts';
const LEGACY_UI_FILE = 'src/ui.tsx';
const TSX = '.tsx';

function decodeUtf8(bytes: unknown): string {
  if (!bytes) return '';
  try {
    return new TextDecoder().decode(bytes as Uint8Array);
  } catch {
    return '';
  }
}

function warnNoStorage(op: string, path: string): void {
  console.warn(`[code-mode] cannot ${op} ${path}: no scene storage on this data layer`);
}

async function writeToDisk(path: string, source: string): Promise<void> {
  const storage = getStorage();
  if (!storage) {
    warnNoStorage('write', path);
    return;
  }
  markLocalEdit();
  try {
    await storage.writeFile(path, new TextEncoder().encode(source) as unknown as Buffer);
  } catch (e) {
    console.error('[code-mode] failed to write', path, e);
  }
}

async function readFromDisk(path: string): Promise<string> {
  const storage = getStorage();
  if (!storage) {
    warnNoStorage('read', path);
    return '';
  }
  try {
    return decodeUtf8(await storage.readFile(path));
  } catch {
    return '';
  }
}

function buildBindingSurface(
  program: unknown,
  comments: unknown,
  source: string,
  componentName?: string,
): BindingSurface {
  const markers = extractBindingSurface(program as any, comments as any, source);
  const stateVars: BindVariable[] = readStateVariables(program as any).map(v => ({
    name: v.name,
    type: v.type,
    expr: `state.${v.name}`,
    value: v.value,
  }));
  const seenState = new Set(stateVars.map(v => v.name));
  const propVars: BindVariable[] = componentName
    ? readPropsVariables(program as any, componentName)
        .filter(v => !seenState.has(v.name))
        .map(v => ({ name: v.name, type: v.type, expr: `props.${v.name}` }))
    : [];
  const seen = new Set([...stateVars, ...propVars].map(v => v.name));
  const variables = [
    ...stateVars,
    ...propVars,
    ...markers.variables.filter(v => !seen.has(v.name)),
  ];
  return { variables, actions: markers.actions };
}

function callbackVars(variables: BindVariable[]): BindVariable[] {
  return variables;
}

function isCurrentParse(filename: string, source: string): boolean {
  return state.filename === filename && state.source === source;
}

const importSurfaceCache = new Map<string, { content: string; surface: BindVariable[] }>();

async function resolveModulePath(activeFilename: string, spec: string): Promise<string | null> {
  const candidates = resolveModuleCandidates(activeFilename, spec);
  if (!candidates) return null;
  const storage = getStorage();
  if (!storage) return null;
  for (const c of candidates) {
    try {
      if (await storage.exists(c)) return c;
    } catch {
      continue;
    }
  }
  return null;
}

async function loadImportedBindSurface(path: string): Promise<BindVariable[]> {
  const source = await readFromDisk(path);
  if (!source) return [];
  const cached = importSurfaceCache.get(path);
  if (cached && cached.content === source) return cached.surface;
  const parser = getCodeParser();
  if (!parser) return cached?.surface ?? [];
  try {
    const result = await parser.parse(path, source);
    if (result.errors && result.errors.length > 0) return cached?.surface ?? [];
    const surface = extractBindingSurface(
      result.program as any,
      result.comments as any,
      source,
    ).variables;
    importSurfaceCache.set(path, { content: source, surface });
    return surface;
  } catch {
    return cached?.surface ?? [];
  }
}

async function resolveImportedVariables(
  program: unknown,
  activeFilename: string,
): Promise<BindVariable[]> {
  const out: BindVariable[] = [];
  for (const imp of collectNamedImports(program as any)) {
    const path = await resolveModulePath(activeFilename, imp.from);
    if (!path || path === activeFilename) continue;
    const exported = await loadImportedBindSurface(path);
    if (!exported.length) continue;
    const byName = new Map(exported.map(v => [v.name, v]));
    for (const s of imp.specifiers) {
      const v = byName.get(s.imported);
      if (v) out.push({ name: s.local, type: v.type, expr: s.local, imported: path });
    }
  }
  return out;
}

async function augmentWithImports(
  filename: string,
  source: string,
  program: unknown,
  comments: unknown,
): Promise<void> {
  const imported = await resolveImportedVariables(program, filename);
  if (!imported.length) return;
  if (!isCurrentParse(filename, source)) return;
  const local = state.bindingSurface.variables;
  const seen = new Set(local.map(v => v.name));
  const variables = [...local, ...imported.filter(v => !seen.has(v.name))];
  const bindingSurface: BindingSurface = { variables, actions: state.bindingSurface.actions };
  const actions = readActions(program as any, comments as any, source, callbackVars(variables));
  set({ bindingSurface, actions });
}

const componentTreeCache = new Map<
  string,
  { content: string; resolved: ResolvedComponent | null }
>();

function collectRefNames(node: CodeUINode | undefined, out: Set<string>): void {
  if (!node) return;
  if (node.componentRef) out.add(node.componentRef.name);
  for (const child of node.children) collectRefNames(child, out);
}

async function resolveComponentTree(name: string): Promise<ResolvedComponent | null> {
  const root = state.roots.find(r => r.name === name);
  if (!root) return null;
  const source =
    root.filename === state.filename ? state.source : await readFromDisk(root.filename);
  if (!source) return null;
  const cached = componentTreeCache.get(root.filename);
  if (cached && cached.content === source) return cached.resolved;
  const parser = getCodeParser();
  if (!parser) return cached?.resolved ?? null;
  try {
    const result = await parser.parse(root.filename, source);
    if (result.errors && result.errors.length > 0) return cached?.resolved ?? null;
    const knownComponents = state.roots.map(r => r.name).filter(n => n !== name);
    const parsed = codeToUINodes(result.program as any, source, {
      componentName: name,
      knownComponents,
    });
    const surface = buildBindingSurface(result.program, result.comments, source);
    const resolved: ResolvedComponent = {
      parsed,
      resolveMap: buildResolveMap(surface.variables),
      props: readPropsVariables(result.program as any, name),
    };
    componentTreeCache.set(root.filename, { content: source, resolved });
    return resolved;
  } catch {
    return cached?.resolved ?? null;
  }
}

async function augmentComponentRefs(filename: string, source: string): Promise<void> {
  const names = new Set<string>();
  collectRefNames(state.parsed?.root, names);
  const entries: [string, ResolvedComponent | null][] = [];
  for (const name of names) entries.push([name, await resolveComponentTree(name)]);
  if (!isCurrentParse(filename, source)) return;
  const cur = state.componentTrees;
  const same =
    Object.keys(cur).length === entries.length && entries.every(([k, v]) => cur[k] === v);
  if (!same) set({ componentTrees: Object.fromEntries(entries) });
}

function pathToNode(root: CodeUINode, entityId: number): number[] | null {
  if ((root.entity as unknown as number) === entityId) return [];
  for (let i = 0; i < root.children.length; i++) {
    const sub = pathToNode(root.children[i], entityId);
    if (sub) return [i, ...sub];
  }
  return null;
}

function nodeAtPath(root: CodeUINode, path: number[]): CodeUINode | undefined {
  let node: CodeUINode | undefined = root;
  for (const i of path) node = node?.children[i];
  return node;
}

function reanchorNodeState(prev: ParsedUI | null, next: ParsedUI | null): void {
  if (!prev?.root || !next?.root) return;

  const mapping: Record<number, number> = {};
  const walk = (node: CodeUINode, path: number[]): void => {
    const target = nodeAtPath(next.root, path);
    if (target && target.type === node.type) {
      mapping[node.entity as unknown as number] = target.entity as unknown as number;
    }
    node.children.forEach((child, i) => walk(child, [...path, i]));
  };
  walk(prev.root, []);
  reduxStore.dispatch(remapNodeIds({ mapping }));

  const selected = getSelectedNodes(reduxStore.getState() as never);
  if (selected.length === 0) return;
  let changed = false;
  const reanchored: Entity[] = [];
  for (const entity of selected) {
    const id = entity as unknown as number;
    if (!pathToNode(prev.root, id)) {
      reanchored.push(entity);
      continue;
    }
    const mapped = mapping[id];
    if (mapped === undefined) {
      changed = true;
      continue;
    }
    if (mapped !== id) changed = true;
    reanchored.push(mapped as unknown as Entity);
  }
  if (changed) reduxStore.dispatch(selectNodes({ nodes: reanchored }));
}

export async function loadAndParse(
  filename: string,
  source: string,
  opts: { persist?: boolean } = {},
): Promise<void> {
  const parser = getCodeParser();
  if (!parser) {
    set({
      filename,
      source,
      parsing: false,
      error: 'Code parser unavailable (Creator Hub / Electron only)',
    });
    return;
  }
  set({ parsing: true });
  try {
    const result = await parser.parse(filename, source);
    if (result.errors && result.errors.length > 0) {
      set({ filename, parsing: false, error: 'Syntax error — change not saved' });
      return;
    }
    const program = result.program as Parameters<typeof codeToUINodes>[0];
    const activeName = state.roots.find(r => r.filename === filename)?.name;
    const knownComponents = state.roots.map(r => r.name).filter(n => n !== activeName);
    if (activeName && opts.persist !== false) {
      const migration = migrateActionsToArgsObject(
        program as any,
        result.comments as any,
        source,
        activeName,
      );
      if (migration.length > 0) {
        await loadAndParse(filename, applyEdits(source, migration), opts);
        return;
      }
    }
    const parsed = codeToUINodes(program, source, { knownComponents });
    lastComments = (result.comments as unknown[]) ?? [];
    const bindingSurface = buildBindingSurface(program, result.comments as any, source, activeName);
    const actions = readActions(
      program as any,
      result.comments as any,
      source,
      callbackVars(bindingSurface.variables),
    );
    const sameFile = state.filename === filename;
    const prevParsed = state.parsed;
    const emptyRoot = !parsed && !!activeName && findComponentIdSpan(program, activeName) !== null;
    set({
      filename,
      source,
      parsing: false,
      parsed: parsed ?? (emptyRoot ? null : state.parsed),
      bindingSurface,
      actions,
      program,
      error: parsed || emptyRoot ? null : 'This file does not follow the UI Designer convention',
      emptyRoot,
    });
    if (sameFile && parsed) reanchorNodeState(prevParsed, parsed);
    else if (!sameFile) reduxStore.dispatch(resetNodeState());
    publishHistory();
    void augmentWithImports(filename, source, program, result.comments);
    void augmentComponentRefs(filename, source);
    if (opts.persist !== false) {
      pendingWrites++;
      void writeToDisk(filename, source).finally(() => {
        pendingWrites--;
      });
    }
  } catch (e) {
    set({ parsing: false, error: e instanceof Error ? e.message : String(e) });
  }
}

let opQueue: Promise<unknown> = Promise.resolve();

function exclusive<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  return (...args: A) => {
    const run = opQueue.then(() => fn(...args));
    opQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}

const UNDO_CAP = 100;
const undoStacks = new Map<string, string[]>();
const redoStacks = new Map<string, string[]>();

function publishHistory(): void {
  const file = state.filename;
  const canUndo = !!file && (undoStacks.get(file)?.length ?? 0) > 0;
  const canRedo = !!file && (redoStacks.get(file)?.length ?? 0) > 0;
  if (canUndo !== state.canUndo || canRedo !== state.canRedo) set({ canUndo, canRedo });
}

function pushUndoSnapshot(filename: string, source: string): void {
  const stack = undoStacks.get(filename) ?? [];
  stack.push(source);
  if (stack.length > UNDO_CAP) stack.shift();
  undoStacks.set(filename, stack);
  redoStacks.delete(filename);
  publishHistory();
}

function clearHistory(filename: string): void {
  undoStacks.delete(filename);
  redoStacks.delete(filename);
  publishHistory();
}

async function undoCodeUnlocked(): Promise<boolean> {
  const file = state.filename;
  if (!file) return false;
  const stack = undoStacks.get(file);
  const prev = stack?.pop();
  if (prev === undefined) return false;
  const redo = redoStacks.get(file) ?? [];
  redo.push(state.source);
  redoStacks.set(file, redo);
  await loadAndParse(file, prev);
  publishHistory();
  return true;
}

async function redoCodeUnlocked(): Promise<boolean> {
  const file = state.filename;
  if (!file) return false;
  const stack = redoStacks.get(file);
  const next = stack?.pop();
  if (next === undefined) return false;
  const undo = undoStacks.get(file) ?? [];
  undo.push(state.source);
  undoStacks.set(file, undo);
  await loadAndParse(file, next);
  publishHistory();
  return true;
}

async function formatActiveFile(): Promise<void> {
  const file = state.filename;
  if (!file || !state.source || state.error) return;
  const formatted = await formatUiSource(state.source);
  if (formatted === state.source) return;
  await loadAndParse(file, formatted);
}

async function applySourceEdits(edits: Edit[], opts: { format?: boolean } = {}): Promise<string> {
  const file = state.filename;
  if (!file) return state.source;
  const next = applyEdits(state.source, edits);
  pushUndoSnapshot(file, state.source);
  await loadAndParse(file, next);
  if (state.source !== next) {
    undoStacks.get(file)?.pop();
    publishHistory();
    return next;
  }
  if (opts.format !== false) await formatActiveFile();
  return next;
}

const rootsKey = (rs: readonly CodeRoot[]): string =>
  rs.map(r => `${r.filename}:${r.topLevel ? 1 : 0}:${r.screenInset}`).join('|');

async function refreshRoots(): Promise<CodeRoot[]> {
  const storage = getStorage();
  if (!storage) {
    if (state.roots.length) set({ roots: [] });
    return [];
  }
  let entries: { name: string; isDirectory: boolean }[] = [];
  try {
    entries = await storage.list(UI_DIR);
  } catch {
    entries = [];
  }
  const prev = new Map(state.roots.map(r => [r.filename, r]));
  let aggregatorInsets: Record<string, UiScreenInset> | undefined;
  const roots: CodeRoot[] = [];
  for (const e of entries) {
    if (e.isDirectory || !e.name.endsWith(TSX) || e.name === 'index.tsx') continue;
    if (UI_HELPERS.has(`${UI_DIR}/${e.name}`)) continue;
    const name = e.name.slice(0, -TSX.length);
    if (toComponentName(name) !== name) continue;
    const filename = `${UI_DIR}/${e.name}`;
    const existing = prev.get(filename);
    const topLevel = existing
      ? existing.topLevel
      : !hasComponentMarker(await readFromDisk(filename));
    const screenInset =
      existing?.screenInset ??
      (aggregatorInsets ??= readRootInsets(await readFromDisk(UI_INDEX)))[name] ??
      DEFAULT_SCREEN_INSET;
    roots.push({ name, filename, topLevel, screenInset });
  }
  roots.sort((a, b) => a.name.localeCompare(b.name));
  if (rootsKey(roots) !== rootsKey(state.roots)) set({ roots });
  return roots;
}

async function regenerateAggregator(roots: CodeRoot[]): Promise<void> {
  const top = roots.filter(r => r.topLevel);
  const src = generateUiIndex(
    top.map(r => ({ component: r.name, from: `./${r.name}`, screenInset: r.screenInset })),
  );
  await writeToDisk(UI_INDEX, src);
}

async function ensureMainWired(): Promise<void> {
  const source = await readFromDisk(SCENE_ENTRY);
  if (!source) return;
  let next = source;

  if (!/(^|\n)[ \t]*setupUi\s*\(\s*\)/.test(next)) {
    next = next.replace(/\/\/[ \t]*setupUi\s*\(\s*\)/, 'setupUi()');
  }
  const callsSetup = /(^|\n)[ \t]*setupUi\s*\(\s*\)/.test(next);
  const importsSetup = /import\s*\{[^}]*\bsetupUi\b[^}]*\}\s*from\s*['"]\.\/ui['"]/.test(next);
  if (callsSetup && !importsSetup) {
    next = `import { setupUi } from './ui'\n${next}`;
  }

  if (next !== source) await writeToDisk(SCENE_ENTRY, next);
}

async function removeLegacySingleFile(): Promise<void> {
  const storage = getStorage();
  if (!storage) return;
  try {
    if (!(await storage.exists(LEGACY_UI_FILE))) return;
    const content = await readFromDisk(LEGACY_UI_FILE);
    if (content.trim() !== '') {
      await writeToDisk(`${LEGACY_UI_FILE}.bak`, content);
    }
    await storage.delete(LEGACY_UI_FILE);
  } catch {
    return;
  }
}

async function createRootUnlocked(desiredName?: string): Promise<string> {
  const name = uniqueName(
    toComponentName(desiredName ?? 'MainUI'),
    state.roots.map(r => r.name),
  );
  const filename = `${UI_DIR}/${name}${TSX}`;
  const source = generateRootComponent(name);
  await writeToDisk(filename, source);
  const roots = await refreshRoots();
  await regenerateAggregator(roots);
  await ensureMainWired();
  await loadAndParse(filename, source, { persist: false });
  return name;
}

export async function selectRootFile(filename: string): Promise<void> {
  const source = await readFromDisk(filename);
  if (!source) return;
  await loadAndParse(filename, source, { persist: false });
}

async function findReferrers(
  name: string,
  exceptFilename: string,
): Promise<{ root: CodeRoot; source: string; program: unknown }[]> {
  const parser = getCodeParser();
  if (!parser) return [];
  const out: { root: CodeRoot; source: string; program: unknown }[] = [];
  for (const root of state.roots) {
    if (root.filename === exceptFilename) continue;
    const source =
      root.filename === state.filename ? state.source : await readFromDisk(root.filename);
    if (!source) continue;
    try {
      const result = await parser.parse(root.filename, source);
      if (result.errors && result.errors.length > 0) continue;
      if (referencesRoot(result.program as any, name)) {
        out.push({ root, source, program: result.program });
      }
    } catch {
      continue;
    }
  }
  return out;
}

async function removeRootUnlocked(filename: string): Promise<string[] | null> {
  const storage = getStorage();
  if (!storage) return null;
  const name = state.roots.find(r => r.filename === filename)?.name;
  if (name) {
    const referrers = await findReferrers(name, filename);
    if (referrers.length > 0) {
      const names = referrers.map(r => r.root.name);
      set({ error: `Can't delete ${name} — used by ${names.join(', ')}` });
      return names;
    }
  }
  await storage.delete(filename).catch(() => undefined);
  clearHistory(filename);
  const roots = await refreshRoots();
  await regenerateAggregator(roots);
  if (state.filename === filename) {
    if (roots.length > 0) await selectRootFile(roots[0].filename);
    else
      set({
        filename: null,
        source: '',
        parsed: null,
        program: undefined,
        error: null,
        emptyRoot: false,
        bindingSurface: { variables: [], actions: [] },
        componentTrees: {},
      });
  }
  return null;
}

async function renameRootUnlocked(filename: string, desiredName: string): Promise<void> {
  const root = state.roots.find(r => r.filename === filename);
  if (!root) return;
  const newName = uniqueName(
    toComponentName(desiredName),
    state.roots.filter(r => r.filename !== filename).map(r => r.name),
  );
  if (newName === root.name) return;

  const source = filename === state.filename ? state.source : await readFromDisk(filename);
  if (!source) return;
  const parser = getCodeParser();
  if (!parser) return;
  const { program } = await parser.parse(filename, source);
  const idSpan = findComponentIdSpan(
    program as Parameters<typeof findComponentIdSpan>[0],
    root.name,
  );
  if (!idSpan) return;

  const referrers = await findReferrers(root.name, filename);

  const renamed = source.slice(0, idSpan.start) + newName + source.slice(idSpan.end);
  const newFilename = `${UI_DIR}/${newName}${TSX}`;
  await writeToDisk(newFilename, renamed);

  const storage = getStorage();
  if (storage) await storage.delete(filename).catch(() => undefined);
  clearHistory(filename);

  for (const ref of referrers) {
    const edits = renameComponentRefEdits(ref.program as any, root.name, newName);
    if (!edits.length) continue;
    const next = applyEdits(ref.source, edits);
    await writeToDisk(ref.root.filename, next);
  }

  const roots = await refreshRoots();
  await regenerateAggregator(roots);
  await ensureMainWired();
  await selectRootFile(newFilename);
}

async function duplicateRootUnlocked(filename: string): Promise<void> {
  const root = state.roots.find(r => r.filename === filename);
  if (!root) return;
  const source = filename === state.filename ? state.source : await readFromDisk(filename);
  if (!source) return;
  const parser = getCodeParser();
  if (!parser) return;
  const { program } = await parser.parse(filename, source);
  const idSpan = findComponentIdSpan(
    program as Parameters<typeof findComponentIdSpan>[0],
    root.name,
  );
  if (!idSpan) return;
  const newName = uniqueName(
    toComponentName(root.name),
    state.roots.map(r => r.name),
  );
  const copied = source.slice(0, idSpan.start) + newName + source.slice(idSpan.end);
  const newFilename = `${UI_DIR}/${newName}${TSX}`;
  await writeToDisk(newFilename, copied);
  const roots = await refreshRoots();
  await regenerateAggregator(roots);
  await loadAndParse(newFilename, copied, { persist: false });
}

let watchTimer: ReturnType<typeof setInterval> | null = null;
let polling = false;
let pendingWrites = 0;

async function pollDisk(): Promise<void> {
  if (polling) return;
  polling = true;
  try {
    const file = state.filename;
    if (file && pendingWrites === 0) {
      const disk = await readFromDisk(file);
      if (disk && disk !== state.source) {
        clearHistory(file);
        await loadAndParse(file, disk, { persist: false });
      }
    }
    const prev = rootsKey(state.roots);
    const roots = await refreshRoots();
    if (rootsKey(roots) !== prev) await regenerateAggregator(roots);
    if (state.filename && pendingWrites === 0) {
      await augmentComponentRefs(state.filename, state.source);
    }
  } finally {
    polling = false;
  }
}

function startWatching(): void {
  if (watchTimer) return;
  watchTimer = setInterval(() => void pollDisk(), 1000);
}

let bootstrapped = false;

export function bootstrapCodeMode(): void {
  if (bootstrapped) return;
  bootstrapped = true;
  void (async () => {
    const roots = await refreshRoots();
    await removeLegacySingleFile();
    if (roots.length > 0) {
      await regenerateAggregator(roots);
      await ensureMainWired();
      await selectRootFile(roots[0].filename);
    }
    startWatching();
  })();
}

function astNodeFor(entityId: number): unknown | undefined {
  return state.parsed?.astNodes.get(entityId);
}

function collectNodeLabels(root: CodeUINode | undefined, exceptId?: number): string[] {
  const out: string[] = [];
  const walk = (n: CodeUINode): void => {
    if ((n.entity as unknown as number) !== exceptId) out.push(nodeLabelText(n));
    n.children.forEach(walk);
  };
  if (root) walk(root);
  return out;
}

export function findCodeNode(
  root: CodeUINode | undefined,
  entityId: number,
): CodeUINode | undefined {
  if (!root) return undefined;
  if ((root.entity as unknown as number) === entityId) return root;
  for (const child of root.children) {
    const found = findCodeNode(child, entityId);
    if (found) return found;
  }
  return undefined;
}

export function findCodeLayoutParent(
  root: CodeUINode | undefined,
  entityId: number,
  inheritedParent?: CodeUINode,
): CodeUINode | undefined {
  if (!root) return undefined;
  const asParent = root.platformVariant ? inheritedParent : root;
  for (const child of root.children) {
    if ((child.entity as unknown as number) === entityId) return asParent;
    const found = findCodeLayoutParent(child, entityId, asParent);
    if (found) return found;
  }
  return undefined;
}

const COMPONENT_FIELD: Record<string, keyof InteractionStateStyles> = {
  'core::UiTransform': 'uiTransform',
  'core::UiBackground': 'uiBackground',
  'core::UiText': 'uiText',
  'core::UiInput': 'uiInput',
  'core::UiDropdown': 'uiDropdown',
};

function codeComponentValue(
  node: CodeUINode | undefined,
  componentId: string,
): Record<string, unknown> | null {
  if (!node) return null;
  if (componentId === UI_BUTTON) return node.uiButton ?? null;
  const field = COMPONENT_FIELD[componentId];
  if (!field) return null;
  return (node[field] as Record<string, unknown>) ?? null;
}

export function codeComponentValueForLayer(
  node: CodeUINode | undefined,
  componentId: string,
  layer: InteractionStateKey,
): Record<string, unknown> | null {
  if (!node?.interaction || layer === 'base' || !isLayerableComponent(componentId)) {
    return codeComponentValue(node, componentId);
  }
  const field = COMPONENT_FIELD[componentId];
  if (!field) return null;
  const base = node.interaction.states.base?.[field] ?? {};
  const own = node.interaction.states[layer]?.[field];
  if (!own) return (base as Record<string, unknown>) ?? null;
  return { ...base, ...own };
}

export function interactionLayerValue(
  node: CodeUINode | undefined,
  componentId: string,
  layer: InteractionStateKey,
): Record<string, unknown> | null {
  const field = COMPONENT_FIELD[componentId];
  if (!node?.interaction || !field) return null;
  return (node.interaction.states[layer]?.[field] as Record<string, unknown>) ?? null;
}

function guardElementWrite(entityId: number, opName: string): boolean {
  const node = findCodeNode(state.parsed?.root, entityId);
  if (node?.componentRef) {
    console.warn(
      `[code-mode] ${opName}: <${node.componentRef.name} /> takes only its declared props — move/size its wrapper UiEntity instead`,
    );
    return false;
  }
  if (node?.opaque) {
    console.warn(`[code-mode] ${opName}: opaque node — edit it in code instead`);
    return false;
  }
  if (node?.platformVariant) {
    console.warn(`[code-mode] ${opName}: platform variant — select one of its branches`);
    return false;
  }
  if (node?.dynamicProps) {
    console.warn(
      `[code-mode] ${opName}: node has dynamic props (bindings/spreads in uiTransform or uiBackground) — edit it in code instead`,
    );
    return false;
  }
  return true;
}

async function spliceComponentPatchUnlocked(
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

async function writeUiTransformFields(
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

function dropPinFields(entityId: number, top: number, left: number): Record<string, unknown> {
  const node = findCodeNode(state.parsed?.root, entityId);
  const current = (node?.uiTransform as Record<string, unknown>) ?? {};
  return uiTransformPatchFields(
    current,
    dragPinPatch(top, left, current),
    boundTransformKeys(node?.bindings),
  );
}

async function spliceUiTransformPositionUnlocked(
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

async function spliceUiTransformPositionsUnlocked(
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

async function spliceUiTransformResizeUnlocked(
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

const CHILD_TEMPLATES: Record<UINodeType, string> = {
  UiEntity:
    '<UiEntity uiTransform={{ width: 200, height: 100 }} uiBackground={{ color: { r: 1, g: 1, b: 1, a: 0.1 } }} />',
  Label: '<Label value="Label" fontSize={24} uiTransform={{ width: 200, height: 36 }} />',
  Button: '<Button value="Button" fontSize={18} uiTransform={{ width: 160, height: 44 }} />',
  Input: '<Input placeholder="Type here" fontSize={18} uiTransform={{ width: 240, height: 44 }} />',
  Dropdown:
    "<Dropdown options={['Option 1', 'Option 2']} fontSize={18} uiTransform={{ width: 240, height: 44 }} />",
};

const IMAGE_TEMPLATE =
  "<UiEntity uiTransform={{ width: 200, height: 200 }} uiBackground={{ color: { r: 1, g: 1, b: 1, a: 1 }, textureMode: 'center' }} />";

function widgetJsx(type: UINodeType, preset?: 'image', named = true): string {
  const jsx =
    preset === 'image' ? IMAGE_TEMPLATE : (CHILD_TEMPLATES[type] ?? CHILD_TEMPLATES.UiEntity);
  if (!named) return jsx;
  const kind: WidgetKind = preset === 'image' ? 'Image' : type === 'UiEntity' ? 'Container' : type;
  return withNodeName(jsx, uniqueName(kind, collectNodeLabels(state.parsed?.root)));
}

async function spliceAddChildUnlocked(
  parentEntityId: number,
  type: UINodeType,
  preset?: 'image',
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

async function spliceAddWidgetUnlocked(
  anchorEntityId: number,
  dropType: 'before' | 'after' | 'inside',
  type: UINodeType,
  preset?: 'image',
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

async function spliceSetRootChildUnlocked(type: UINodeType, preset?: 'image'): Promise<void> {
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

async function buildReferenceGraph(): Promise<Map<string, string[]>> {
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

async function canNest(parentRootName: string, childName: string): Promise<boolean> {
  if (parentRootName === childName) return false;
  const refs = await buildReferenceGraph();
  return !wouldCycle(refs, parentRootName, childName);
}

async function spliceInsertComponentUnlocked(
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

async function spliceInstancePropUnlocked(
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

async function unsetInstancePropUnlocked(entityId: number, name: string): Promise<void> {
  const ast = astNodeFor(entityId) as Parameters<typeof removeAttribute>[0] | undefined;
  if (!ast) return;
  await applySourceEdits(removeAttribute(ast, state.source, name));
}

async function toggleTopLevelUnlocked(filename: string): Promise<void> {
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

async function setRootScreenInsetUnlocked(filename: string, inset: UiScreenInset): Promise<void> {
  const root = state.roots.find(r => r.filename === filename);
  if (!root || root.screenInset === inset) return;
  const roots = state.roots.map(r => (r.filename === filename ? { ...r, screenInset: inset } : r));
  set({ roots });
  await regenerateAggregator(roots);
}

async function spliceRemoveNodeUnlocked(entityId: number): Promise<void> {
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

async function spliceRemoveNodesUnlocked(entityIds: number[]): Promise<void> {
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

async function spliceMoveUnlocked(entityId: number, anchor: MoveAnchor): Promise<void> {
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

async function spliceDuplicateUnlocked(entityId: number): Promise<number | null> {
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

async function spliceRenameNodeUnlocked(entityId: number, desired: string): Promise<void> {
  const node = findCodeNode(state.parsed?.root, entityId);
  if (!node || node.opaque || node.componentRef || node.platformVariant || node.platform) return;
  const el = astNodeFor(entityId) as Parameters<typeof nodeNameEdit>[0] | undefined;
  if (!el) return;
  const clean = sanitizeNodeName(desired);
  const name = clean ? uniqueName(clean, collectNodeLabels(state.parsed?.root, entityId)) : '';
  const edits = nodeNameEdit(el, state.source, name);
  if (edits.length) await applySourceEdits(edits);
}

function interactionTargetFor(entityId: number, attrName: string): InteractionAst | null {
  const node = findCodeNode(state.parsed?.root, entityId);
  if (!node?.interaction || !isLayerableProp(node.type, attrName)) return null;
  return interactionAstFor(entityId);
}

function styleObjectFor(componentId: string | undefined): 'uiTransform' | 'uiBackground' | null {
  if (componentId === 'core::UiTransform') return 'uiTransform';
  if (componentId === 'core::UiBackground') return 'uiBackground';
  return null;
}

async function writeStyleKey(
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

async function writeTransformBinding(
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

async function writeBackgroundBinding(
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

async function bindAttributeUnlocked(
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
  const interaction = interactionTargetFor(entityId, name);
  if (interaction) {
    await applySourceEdits(setInteractionFlat(interaction, 'base', { [name]: raw(expr) }));
    return;
  }
  await applySourceEdits(setAttributeExpr(ast, name, expr));
}

async function unbindAttributeUnlocked(
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

async function setMixedContentAttributeUnlocked(
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
  await applySourceEdits(setAttributeSegments(ast, name, segments));
}

async function ensureInteractionHelper(): Promise<void> {
  if (await readFromDisk(UI_INTERACTION)) return;
  await writeToDisk(UI_INTERACTION, generateInteractionHelper());
}

function interactionAstFor(entityId: number): InteractionAst | null {
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

function uniqueLocalName(base: string, source: string): string {
  const safe = isValidIdentifier(base) ? base : 'interactionStyles';
  let name = safe;
  for (let i = 1; new RegExp(`\\b${name}\\b`).test(source); i++) name = `${safe}${i}`;
  return name;
}

async function addInteractionStatesUnlocked(entityId: number): Promise<void> {
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

async function removeInteractionStatesUnlocked(entityId: number): Promise<void> {
  const ast = interactionAstFor(entityId);
  const el = astNodeFor(entityId) as Parameters<typeof unwrapInteractionEdits>[1] | undefined;
  if (!ast || !el) return;
  const edits = unwrapInteractionEdits(ast, el, state.source);
  if (edits.length) await applySourceEdits(edits);
}

async function setInteractionFieldUnlocked(
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

async function addInteractionLayerUnlocked(
  entityId: number,
  stateKey: InteractionStateKey,
): Promise<void> {
  const ast = interactionAstFor(entityId);
  if (!ast) return;
  const edits = addInteractionState(ast, stateKey);
  if (edits.length) await applySourceEdits(edits);
}

async function removeInteractionLayerUnlocked(
  entityId: number,
  stateKey: InteractionStateKey,
): Promise<void> {
  const ast = interactionAstFor(entityId);
  if (!ast) return;
  const edits = removeInteractionState(ast, stateKey);
  if (edits.length) await applySourceEdits(edits);
}

async function setInteractionActiveBindingUnlocked(
  entityId: number,
  expr: string | undefined,
): Promise<void> {
  const ast = interactionAstFor(entityId);
  if (!ast) return;
  const edits = setInteractionActive(ast, expr);
  if (edits.length) await applySourceEdits(edits);
}

async function ensurePlatformHelper(): Promise<void> {
  if (await readFromDisk(UI_PLATFORM)) return;
  await writeToDisk(UI_PLATFORM, generatePlatformHelper());
}

function activePlatform(): DeviceKind {
  return getPlatform(reduxStore.getState() as never);
}

function platformStatements(): Parameters<typeof findPlatformConst>[0] {
  if (!state.program) return [];
  const fn = findComponentFn(
    state.program as Parameters<typeof findComponentFn>[0],
    activeComponentName(),
  );
  return componentStatements(fn as Parameters<typeof componentStatements>[0]);
}

function platformAstFor(entityId: number): PlatformVariantAst | null {
  const node = astNodeFor(entityId) as Parameters<typeof parsePlatformConditional>[0] | undefined;
  if (!node) return null;
  return parsePlatformConditional(node, platformStatements());
}

function platformVariantOf(entityId: number): { variant: CodeUINode; branch?: CodeUINode } | null {
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

function guardPlatformBranch(entityId: number, opName: string): boolean {
  if (!findCodeNode(state.parsed?.root, entityId)?.platform) return true;
  console.warn(`[code-mode] ${opName}: a platform branch can't be moved out of its variant`);
  return false;
}

async function addPlatformVariantUnlocked(entityId: number): Promise<void> {
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

async function addPlatformBranchUnlocked(entityId: number, platform: DeviceKind): Promise<void> {
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

async function removePlatformVariantUnlocked(
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

async function ensureStateScaffold(): Promise<void> {
  if (!state.program) return;
  if (findStateNodes(state.program as any).object) return;
  const at = afterImports(state.program as any);
  await applySourceEdits([
    { start: at, end: at, text: '\n\nexport interface State {}\nexport const state: State = {}' },
  ]);
}

async function addBindVariableUnlocked(
  name: string,
  type: string,
  rawDefault?: string,
): Promise<void> {
  await ensureStateScaffold();
  if (!state.program) return;
  const edits = addStateProperty(state.program as any, name, type, rawDefault);
  if (edits.length) await applySourceEdits(edits);
}

async function setStateVariableValueUnlocked(
  name: string,
  type: string,
  rawDefault: string,
): Promise<void> {
  if (!state.program) return;
  const edits = setStatePropertyValue(state.program as any, name, type, rawDefault);
  if (edits.length) await applySourceEdits(edits);
}

async function ensureUiActionScaffold(): Promise<void> {
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

async function addBindActionUnlocked(name: string): Promise<void> {
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

async function removeActionUnlocked(name: string): Promise<void> {
  if (!state.program) return;
  const edits = removeActionDecl(state.program as any, name, lastComments as any, state.source);
  if (edits.length) await applySourceEdits(edits);
}

async function setActionBodyUnlocked(name: string, template: string): Promise<void> {
  if (!state.program) return;
  const code = templateToBody(template, callbackVars(state.bindingSurface.variables));
  const edits = setActionBodyEdit(state.program as any, name, code);
  if (edits.length) await applySourceEdits(edits);
}

async function removeStateVariableUnlocked(name: string): Promise<void> {
  if (!state.program) return;
  const edits = removeStateProperty(state.program as any, name);
  if (edits.length) await applySourceEdits(edits);
}

async function retypeStateVariableUnlocked(name: string, type: string): Promise<void> {
  if (!state.program) return;
  const edits = setStatePropertyType(state.program as any, name, type);
  if (edits.length) await applySourceEdits(edits);
}

function activeComponentName(): string | undefined {
  return state.roots.find(r => r.filename === state.filename)?.name;
}

async function addBindPropUnlocked(name: string, type: string): Promise<void> {
  const cn = activeComponentName();
  if (!state.program || !cn) return;
  const edits = addPropsProperty(state.program as any, state.source, cn, name, propTypeToTs(type));
  if (edits.length) await applySourceEdits(edits);
}

async function removePropUnlocked(name: string): Promise<void> {
  const cn = activeComponentName();
  if (!state.program || !cn) return;
  const edits = removePropsProperty(state.program as any, cn, name);
  if (edits.length) await applySourceEdits(edits);
}

async function retypePropUnlocked(name: string, type: string): Promise<void> {
  const cn = activeComponentName();
  if (!state.program || !cn) return;
  const edits = setPropsPropertyType(state.program as any, cn, name, propTypeToTs(type));
  if (edits.length) await applySourceEdits(edits);
}

export const undoCode = exclusive(undoCodeUnlocked);
export const redoCode = exclusive(redoCodeUnlocked);
export const createRoot = exclusive(createRootUnlocked);
export const removeRoot = exclusive(removeRootUnlocked);
export const renameRoot = exclusive(renameRootUnlocked);
export const toggleTopLevel = exclusive(toggleTopLevelUnlocked);
export const setRootScreenInset = exclusive(setRootScreenInsetUnlocked);
export const spliceComponentPatch = exclusive(spliceComponentPatchUnlocked);
export const spliceUiTransformPosition = exclusive(spliceUiTransformPositionUnlocked);
export const spliceUiTransformPositions = exclusive(spliceUiTransformPositionsUnlocked);
export const spliceUiTransformResize = exclusive(spliceUiTransformResizeUnlocked);
export const spliceAddChild = exclusive(spliceAddChildUnlocked);
export const spliceAddWidget = exclusive(spliceAddWidgetUnlocked);
export const spliceSetRootChild = exclusive(spliceSetRootChildUnlocked);
export const spliceInsertComponent = exclusive(spliceInsertComponentUnlocked);
export const spliceInstanceProp = exclusive(spliceInstancePropUnlocked);
export const unsetInstanceProp = exclusive(unsetInstancePropUnlocked);
export const spliceRemoveNodes = exclusive(spliceRemoveNodesUnlocked);
export const spliceMove = exclusive(spliceMoveUnlocked);
export const spliceDuplicate = exclusive(spliceDuplicateUnlocked);
export const spliceRenameNode = exclusive(spliceRenameNodeUnlocked);
export const bindAttribute = exclusive(bindAttributeUnlocked);
export const unbindAttribute = exclusive(unbindAttributeUnlocked);
export const setMixedContentAttribute = exclusive(setMixedContentAttributeUnlocked);
export const addBindVariable = exclusive(addBindVariableUnlocked);
export const setStateVariableValue = exclusive(setStateVariableValueUnlocked);
export const addBindAction = exclusive(addBindActionUnlocked);
export const removeAction = exclusive(removeActionUnlocked);
export const setActionBody = exclusive(setActionBodyUnlocked);
export const removeStateVariable = exclusive(removeStateVariableUnlocked);
export const retypeStateVariable = exclusive(retypeStateVariableUnlocked);
export const addBindProp = exclusive(addBindPropUnlocked);
export const removeProp = exclusive(removePropUnlocked);
export const retypeProp = exclusive(retypePropUnlocked);
export const addInteractionStates = exclusive(addInteractionStatesUnlocked);
export const removeInteractionStates = exclusive(removeInteractionStatesUnlocked);
export const setInteractionField = exclusive(setInteractionFieldUnlocked);
export const addInteractionLayer = exclusive(addInteractionLayerUnlocked);
export const removeInteractionLayer = exclusive(removeInteractionLayerUnlocked);
export const setInteractionActiveBinding = exclusive(setInteractionActiveBindingUnlocked);
export const addPlatformVariant = exclusive(addPlatformVariantUnlocked);
export const addPlatformBranch = exclusive(addPlatformBranchUnlocked);
export const removePlatformVariant = exclusive(removePlatformVariantUnlocked);
