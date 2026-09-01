import { useSyncExternalStore } from 'react';
import type { Entity } from '@dcl/ecs';
import { getCodeParser } from '../../../lib/logic/code-parser';
import { markLocalEdit } from '../../../lib/logic/local-edit';
import { getStorage } from '../../../lib/data-layer/client/storage';
import { store as reduxStore } from '../../../redux/store';
import {
  getSelectedNodes,
  remapNodeIds,
  resetNodeState,
  selectNodes,
} from '../../../redux/ui-designer';
import {
  DEFAULT_SCREEN_INSET,
  generateRootComponent,
  generateUiIndex,
  readRootInsets,
  type UiScreenInset,
} from './aggregator';
import { type CodeAction, migrateActionsToArgsObject, readActions } from './actions';
import {
  type BindingSurface,
  type BindVariable,
  buildResolveMap,
  extractBindingSurface,
} from './bindings';
import { collectNamedImports, resolveModuleCandidates } from './imports';
import { readStateVariables } from './state-convention';
import { type PropVar, readPropsVariables } from './props-convention';
import { referencesRoot, renameComponentRefEdits } from './component-graph';
import { hasComponentMarker } from './component-marker';
import { applyEdits, type Edit } from './emit-adapter';
import { formatUiSource } from './formatting';
import { codeToUINodes, findComponentIdSpan } from './parse-adapter';
import { toComponentName, uniqueName } from './root-naming';
import type { CodeUINode, ParsedUI } from './types';

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

export let state: CodeState = {
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

export const listeners = new Set<() => void>();

export let lastComments: unknown[] = [];

export function set(next: Partial<CodeState>) {
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

export const UI_DIR = 'src/ui';
export const UI_INDEX = 'src/ui/index.tsx';
export const UI_INTERACTION = 'src/ui/interaction.tsx';
export const UI_INTERACTION_IMPORT = './interaction';
export const UI_PLATFORM = 'src/ui/platform.tsx';
export const UI_PLATFORM_IMPORT = './platform';
export const UI_HELPERS = new Set([UI_INTERACTION, UI_PLATFORM]);
export const SCENE_ENTRY = 'src/index.ts';
export const LEGACY_UI_FILE = 'src/ui.tsx';
export const TSX = '.tsx';

export function decodeUtf8(bytes: unknown): string {
  if (!bytes) return '';
  try {
    return new TextDecoder().decode(bytes as Uint8Array);
  } catch {
    return '';
  }
}

export function warnNoStorage(op: string, path: string): void {
  console.warn(`[code-mode] cannot ${op} ${path}: no scene storage on this data layer`);
}

export async function writeToDisk(path: string, source: string): Promise<void> {
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

export async function readFromDisk(path: string): Promise<string> {
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

export function buildBindingSurface(
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

export function callbackVars(variables: BindVariable[]): BindVariable[] {
  return variables;
}

export function isCurrentParse(filename: string, source: string): boolean {
  return state.filename === filename && state.source === source;
}

export const importSurfaceCache = new Map<string, { content: string; surface: BindVariable[] }>();

export async function resolveModulePath(
  activeFilename: string,
  spec: string,
): Promise<string | null> {
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

export async function loadImportedBindSurface(path: string): Promise<BindVariable[]> {
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

export async function resolveImportedVariables(
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

export async function augmentWithImports(
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

export const componentTreeCache = new Map<
  string,
  { content: string; resolved: ResolvedComponent | null }
>();

export function collectRefNames(node: CodeUINode | undefined, out: Set<string>): void {
  if (!node) return;
  if (node.componentRef) out.add(node.componentRef.name);
  for (const child of node.children) collectRefNames(child, out);
}

export async function resolveComponentTree(name: string): Promise<ResolvedComponent | null> {
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

export async function augmentComponentRefs(filename: string, source: string): Promise<void> {
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

export function pathToNode(root: CodeUINode, entityId: number): number[] | null {
  if ((root.entity as unknown as number) === entityId) return [];
  for (let i = 0; i < root.children.length; i++) {
    const sub = pathToNode(root.children[i], entityId);
    if (sub) return [i, ...sub];
  }
  return null;
}

export function nodeAtPath(root: CodeUINode, path: number[]): CodeUINode | undefined {
  let node: CodeUINode | undefined = root;
  for (const i of path) node = node?.children[i];
  return node;
}

export function reanchorNodeState(prev: ParsedUI | null, next: ParsedUI | null): void {
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

export let opQueue: Promise<unknown> = Promise.resolve();

export function exclusive<A extends unknown[], R>(
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

export const UNDO_CAP = 100;
export const undoStacks = new Map<string, string[]>();
export const redoStacks = new Map<string, string[]>();

export function publishHistory(): void {
  const file = state.filename;
  const canUndo = !!file && (undoStacks.get(file)?.length ?? 0) > 0;
  const canRedo = !!file && (redoStacks.get(file)?.length ?? 0) > 0;
  if (canUndo !== state.canUndo || canRedo !== state.canRedo) set({ canUndo, canRedo });
}

export function pushUndoSnapshot(filename: string, source: string): void {
  const stack = undoStacks.get(filename) ?? [];
  stack.push(source);
  if (stack.length > UNDO_CAP) stack.shift();
  undoStacks.set(filename, stack);
  redoStacks.delete(filename);
  publishHistory();
}

export function clearHistory(filename: string): void {
  undoStacks.delete(filename);
  redoStacks.delete(filename);
  publishHistory();
}

export async function undoCodeUnlocked(): Promise<boolean> {
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

export async function redoCodeUnlocked(): Promise<boolean> {
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

export async function formatActiveFile(): Promise<void> {
  const file = state.filename;
  if (!file || !state.source || state.error) return;
  const formatted = await formatUiSource(state.source);
  if (formatted === state.source) return;
  await loadAndParse(file, formatted);
}

export async function applySourceEdits(
  edits: Edit[],
  opts: { format?: boolean } = {},
): Promise<string> {
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

export const rootsKey = (rs: readonly CodeRoot[]): string =>
  rs.map(r => `${r.filename}:${r.topLevel ? 1 : 0}:${r.screenInset}`).join('|');

export async function refreshRoots(): Promise<CodeRoot[]> {
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

export async function regenerateAggregator(roots: CodeRoot[]): Promise<void> {
  const top = roots.filter(r => r.topLevel);
  const src = generateUiIndex(
    top.map(r => ({ component: r.name, from: `./${r.name}`, screenInset: r.screenInset })),
  );
  await writeToDisk(UI_INDEX, src);
}

export async function ensureMainWired(): Promise<void> {
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

export async function removeLegacySingleFile(): Promise<void> {
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

export async function createRootUnlocked(desiredName?: string): Promise<string> {
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

export async function findReferrers(
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

export async function removeRootUnlocked(filename: string): Promise<string[] | null> {
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

export async function renameRootUnlocked(filename: string, desiredName: string): Promise<void> {
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

export async function duplicateRootUnlocked(filename: string): Promise<void> {
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

export let watchTimer: ReturnType<typeof setInterval> | null = null;
export let polling = false;
export let pendingWrites = 0;

export async function pollDisk(): Promise<void> {
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

export function startWatching(): void {
  if (watchTimer) return;
  watchTimer = setInterval(() => void pollDisk(), 1000);
}

export let bootstrapped = false;

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
