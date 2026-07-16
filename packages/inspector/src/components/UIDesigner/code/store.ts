import { useSyncExternalStore } from 'react';
import type { Entity } from '@dcl/ecs';

import { getCodeParser } from '../../../lib/logic/code-parser/iframe';
import { getStorage } from '../../../lib/data-layer/client/iframe-data-layer';
import { store as reduxStore } from '../../../redux/store';
import {
  getSelectedNode,
  remapNodeIds,
  resetNodeState,
  selectNode,
} from '../../../redux/ui-designer';
import type { UINodeType } from '../tree-model';
import { generateRootComponent, generateUiIndex } from './aggregator';
import {
  type CodeAction,
  readActions,
  removeActionDecl,
  setActionBodyEdit,
  templateToBody,
} from './actions';
import {
  type BindingSurface,
  type BindVariable,
  buildResolveMap,
  extractBindingSurface,
} from './bindings';
import { collectNamedImports, resolveModuleCandidates } from './imports';
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
  moveElement,
  removeAttribute,
  removeNode,
  setAttribute,
  setAttributeExpr,
  setAttributeSegments,
  setObjectField,
  setObjectFields,
} from './emit-adapter';
import { pbBackgroundFieldToErgo, pbToErgonomicText } from './ecs-shape';
import { formatUiSource } from './formatting';
import { uiTransformPatchEdits } from './transform-patch';
import { codeToUINodes, findComponentIdSpan } from './parse-adapter';
import { toComponentName, uniqueRootName } from './root-naming';
import type { CodeUINode, ParsedUI } from './types';

// Code-mode store: the scene's real .tsx files on disk are the single source of
// truth; the canvas is a view over them, and an external editor (VSCode / vim /
// Notepad) edits the same files. A disk watcher (poll) reflects external edits
// onto the canvas; canvas edits splice the source and write it straight back to
// the scene folder. Parsing is delegated to CH main over the CodeParser RPC.
// Implemented as a tiny external store so Canvas, NodeTree, CodeRootsList, and
// PropertyPanel all read the same state via useSyncExternalStore.
//
// Layout is file-per-root: each UI root is one file under src/ui/, and a
// generated src/ui/index.tsx aggregator composes them into setupUi(). `filename`
// is the *active* root file (the one the canvas edits); the aggregator is
// generated-only and never loaded as active.

// One UI root = one component file under src/ui/.
export interface CodeRoot {
  // Exported component name, e.g. "MainUI".
  name: string;
  // Full path, e.g. "src/ui/MainUI.tsx".
  filename: string;
  // Whether this root is a top-level SCREEN (rendered by the aggregator) vs a
  // reusable COMPONENT (only rendered where another root nests it). Driven by
  // the `/** @ui-component */` marker (absent = top-level). Default: promoted.
  topLevel: boolean;
}

// A referenced component's parsed tree (+ its default-value map) for the inline
// read-only preview a component-ref node renders.
export interface ResolvedComponent {
  parsed: ParsedUI;
  // expr (`state.x` / bare marker) → default value string, so a bound Label in
  // the nested component previews its default (`value={state.title}` → "Menu").
  resolveMap: Record<string, string>;
  // The component's declared props (name + type) — the fields a selected
  // instance exposes for editing in the panel.
  props: PropVar[];
}

export interface CodeState {
  // The active root file the canvas edits (null before any root loads).
  filename: string | null;
  source: string;
  parsed: ParsedUI | null;
  // The roots discovered under src/ui/ (each a component file).
  roots: CodeRoot[];
  // Resolved trees for the components referenced by the active tree, keyed by
  // component name — the inline read-only preview each `<Name />` renders.
  componentTrees: Record<string, ResolvedComponent | null>;
  // @ui-bind / @ui-action declarations found in the active source.
  bindingSurface: BindingSurface;
  // @ui-action handlers with their parsed structured bodies (for the callbacks
  // panel). Distinct from bindingSurface.actions (which is just names).
  actions: CodeAction[];
  // Raw ESTree program (for insertion-point math, e.g. afterImports).
  program: unknown;
  error: string | null;
  parsing: boolean;
  // Whether the ACTIVE file has splice history to undo/redo (drives the
  // toolbar buttons; the stacks themselves are module-private).
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
  parsing: false,
  canUndo: false,
  canRedo: false,
};

const listeners = new Set<() => void>();

// Comments from the last parse, kept for edits that must locate a JSDoc marker
// (removeActionDecl needs the `/** @ui-action */` comment span). Not UI state.
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

// The scene files backing code-mode (file-per-root).
export const UI_DIR = 'src/ui';
export const UI_INDEX = 'src/ui/index.tsx';
const SCENE_ENTRY = 'src/index.ts';
// The stock single-file template we replace with the src/ui/ directory (see
// removeLegacySingleFile).
const LEGACY_UI_FILE = 'src/ui.tsx';
const TSX = '.tsx';

// readFile returns raw bytes; over the iframe↔CH RPC a Node Buffer arrives as a
// plain Uint8Array (the Buffer subclass prototype is lost), so `.toString('utf8')`
// would yield a comma-joined byte string ("47,42,…") instead of text. Decode with
// TextDecoder / encode with TextEncoder (matches fs-composite-provider).
function decodeUtf8(bytes: unknown): string {
  if (!bytes) return '';
  try {
    return new TextDecoder().decode(bytes as Uint8Array);
  } catch {
    return '';
  }
}

// Write a file to the scene folder through the storage bridge. The parent
// StorageRPC mkdir -p's the parent dir, so a nested path (src/ui/X.tsx) creates
// src/ui/ automatically. Writes are immediate (no debounce): canvas ops are
// discrete (mouseup), and immediate writes keep disk == state.source so the disk
// watcher never mistakes our own write for an external edit.
async function writeToDisk(path: string, source: string): Promise<void> {
  const storage = getStorage();
  if (!storage) return;
  try {
    await storage.writeFile(path, new TextEncoder().encode(source) as unknown as Buffer);
  } catch (e) {
    console.error('[code-mode] failed to write', path, e);
  }
}

async function readFromDisk(path: string): Promise<string> {
  const storage = getStorage();
  if (!storage) return '';
  try {
    return decodeUtf8(await storage.readFile(path));
  } catch {
    return '';
  }
}

// Merge the binding conventions into one surface (precedence high→low): the typed
// `state` object (`value={state.x}`), the active component's declared props
// (`value={props.x}`, when `componentName` is given), then hand-authored
// /** @ui-bind */ markers (`value={x}`) for foreign code. Earlier kinds shadow a
// same-named later one. Actions come only from @ui-action markers.
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
  // Props are bindable INSIDE the component render; they carry no default
  // value. All declared props are surfaced (the props manager lists them);
  // the pickers filter by TYPE, so 'unknown'/'callback' props are never
  // offered where they can't bind.
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

// props (`props.x`) are valid in the render but NOT in a top-level @ui-action
// handler body (out of scope there) — filter them out of the callback surface.
function callbackVars(variables: BindVariable[]): BindVariable[] {
  return variables.filter(v => !v.expr.startsWith('props.'));
}

// True while `filename`/`source` are still the active parse. The async second-
// phase augmentations (imports, component refs) check this before their `set` so
// a resolution from a superseded edit can't clobber newer state.
function isCurrentParse(filename: string, source: string): boolean {
  return state.filename === filename && state.source === source;
}

// ---------------------------------------------------------------------------
// Cross-file @ui-bind imports: a variable declared in another scene file and
// imported into the active root (`import { score } from './shared'`) is in
// scope, so a field can bind to it bare — it belongs in the surface too. We
// resolve these lazily off the active parse (loadAndParse only runs on an actual
// edit, so this is not a hot loop) and merge them in a second `set`.
// ---------------------------------------------------------------------------

// The @ui-bind surface of an imported file, cached by its content so a repeat
// resolution with unchanged source costs a map hit and no RPC. One entry per
// path (replaced on content change) keeps it bounded.
const importSurfaceCache = new Map<string, { content: string; surface: BindVariable[] }>();

// Probe the candidate paths for a relative specifier; the first that exists wins.
async function resolveModulePath(activeFilename: string, spec: string): Promise<string | null> {
  const candidates = resolveModuleCandidates(activeFilename, spec);
  if (!candidates) return null;
  const storage = getStorage();
  if (!storage) return null;
  for (const c of candidates) {
    try {
      if (await storage.exists(c)) return c;
    } catch {
      // ignore a stat error and try the next candidate
    }
  }
  return null;
}

// Read + parse an imported file and extract its @ui-bind variables (returns the
// last-cached surface on a transient parse error / mid-edit broken file, so an
// imported var doesn't blink out while the other file is being typed in).
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

// Resolve every imported @ui-bind variable the active file pulls in, remapped to
// its local name (`{ score as pts }` → surfaced as `pts`, bound bare as `pts`).
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

// Phase 2 of the surface build: merge imported @ui-bind vars into the surface
// and recompute actions (a handler may reference an imported var, which the
// template reader needs in its var list). Fire-and-forget from loadAndParse;
// guarded so a resolution from a superseded parse can't clobber a newer surface.
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

// ---------------------------------------------------------------------------
// Component-ref inline preview (Phase 2): resolve each referenced root's parsed
// tree so a `<Name />` on the canvas renders that root's real UI read-only.
// Mirrors augmentWithImports — a second, guarded, cached async pass.
// ---------------------------------------------------------------------------

// Resolved tree per referenced root, cached by content: an unchanged file is a
// map hit that returns the SAME object, letting augmentComponentRefs skip a
// no-op re-render (and keeping the 1 s poll cheap).
const componentTreeCache = new Map<
  string,
  { content: string; resolved: ResolvedComponent | null }
>();

function collectRefNames(node: CodeUINode | undefined, out: Set<string>): void {
  if (!node) return;
  if (node.componentRef) out.add(node.componentRef.name);
  for (const child of node.children) collectRefNames(child, out);
}

// Parse a referenced root and build its read-only preview tree + default-value
// map. One level deep: component-refs INSIDE it render as labeled blocks, not
// recursively resolved.
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
    let resolved: ResolvedComponent | null = null;
    if (parsed) {
      const surface = buildBindingSurface(result.program, result.comments, source);
      resolved = {
        parsed,
        resolveMap: buildResolveMap(surface.variables),
        props: readPropsVariables(result.program as any, name),
      };
    }
    componentTreeCache.set(root.filename, { content: source, resolved });
    return resolved;
  } catch {
    return cached?.resolved ?? null;
  }
}

// Phase-2 augmentation: resolve the inline preview tree for each component ref in
// the active tree, then a guarded second `set`. Skips the set when nothing
// changed so the poll doesn't churn re-renders.
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

// ---------------------------------------------------------------------------
// Selection re-anchoring. Synthetic node ids are assigned in SOURCE ORDER on
// every parse, so any edit earlier in the file shifts every later node's id —
// a raw id held in redux would silently point at a DIFFERENT node after a
// reparse, and the next panel write would mutate the wrong element. After each
// same-file reparse we re-resolve the selected node by its child-index path
// (stable across content edits) and re-dispatch when the id moved.
// ---------------------------------------------------------------------------

// Child-index path from the root to the node with `entityId`, or null.
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

// Re-map ALL id-keyed redux node state (selection, expansion, hidden, locked)
// from the pre-parse tree onto the new tree. Same path + same element type →
// same logical node (content edits, external text edits). A vanished path
// (node deleted externally) drops its entries and clears the selection so a
// later write can't hit an unrelated node that inherited the id.
function reanchorNodeState(prev: ParsedUI | null, next: ParsedUI | null): void {
  if (!prev?.root || !next?.root) return;

  // oldId → newId for every node whose child-index path survives with the
  // same element type.
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

  const selected = getSelectedNode(reduxStore.getState() as never);
  if (selected == null) return;
  const id = selected as unknown as number;
  if (!pathToNode(prev.root, id)) return; // selection wasn't in this tree
  const mapped = mapping[id];
  if (mapped === undefined) {
    reduxStore.dispatch(selectNode({ node: null }));
  } else if (mapped !== id) {
    reduxStore.dispatch(selectNode({ node: mapped as unknown as Entity }));
  }
}

// Parse `source` (via the RPC bridge) and update the active tree. Keeps the
// previous parsed tree on failure so a transient broken-code state doesn't blank
// the canvas — the error is surfaced separately. `persist` (default true) writes
// the source back to disk on a successful parse; disk reads (bootstrap / watcher)
// pass false.
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
    // Syntax error → the source doesn't parse. Keep the last-good filename/source/
    // tree, surface the error, and CRUCIALLY do not persist: a broken splice (or a
    // hand-typed invalid body) must never reach disk and corrupt the scene file.
    // The active `filename` is still set so the header/disk-watcher can recover it
    // once the file becomes valid again.
    if (result.errors && result.errors.length > 0) {
      set({ filename, parsing: false, error: 'Syntax error — change not saved' });
      return;
    }
    // result.program is the ESTree AST as plain JSON (typed `unknown` over RPC).
    const program = result.program as Parameters<typeof codeToUINodes>[0];
    // Other roots may appear as component references (`<OtroNOmbre />`). Exclude
    // this file's own component so a stray self-reference stays opaque.
    const activeName = state.roots.find(r => r.filename === filename)?.name;
    const knownComponents = state.roots.map(r => r.name).filter(n => n !== activeName);
    const parsed = codeToUINodes(program, source, { knownComponents });
    lastComments = (result.comments as unknown[]) ?? [];
    const bindingSurface = buildBindingSurface(program, result.comments as any, source, activeName);
    const actions = readActions(
      program as any,
      result.comments as any,
      source,
      callbackVars(bindingSurface.variables),
    );
    // Same-file reparse → ids were reassigned in source order; re-anchor every
    // id-keyed consumer (selection, expansion, hidden/locked). A file SWITCH
    // instead resets that state — the previous file's positional ids would
    // collide with the new file's.
    const sameFile = state.filename === filename;
    const prevParsed = state.parsed;
    set({
      filename,
      source,
      parsing: false,
      parsed: parsed ?? state.parsed,
      bindingSurface,
      actions,
      program,
      error: parsed ? null : 'This file does not follow the UI Designer convention',
    });
    if (sameFile && parsed) reanchorNodeState(prevParsed, parsed);
    else if (!sameFile) reduxStore.dispatch(resetNodeState());
    publishHistory();
    // Phase 2 (async, non-blocking): fold in @ui-bind vars imported from other
    // files. The local surface is already live above, so the canvas doesn't wait.
    void augmentWithImports(filename, source, program, result.comments);
    // Resolve inline read-only previews for any nested component references.
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

// ---------------------------------------------------------------------------
// Op serialization: every mutating op COMPUTES its span edits from the live
// state and then applies them through an async RPC parse. Two ops in flight at
// once would compute against the same stale tree — the second one's byte
// offsets would be wrong against the first one's output (lost update or a
// mis-placed splice). `exclusive` chains each public mutating op behind the
// previous one; PRIVATE helpers (ensureStateScaffold, refreshRoots, …) stay
// unqueued because they run inside an already-queued op (re-entrancy would
// deadlock).
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Undo/redo: per-file source-snapshot stacks. Every visual op flows through
// applySourceEdits, which pushes the pre-edit source; undo/redo swap whole
// buffers (source strings are small and splices are discrete ops, so snapshots
// beat operational transforms in simplicity). External edits (disk watcher)
// CLEAR the file's history — the external editor owns its own undo, and mixing
// the two timelines silently reverts work the user did elsewhere.
// ---------------------------------------------------------------------------

const UNDO_CAP = 100;
const undoStacks = new Map<string, string[]>();
const redoStacks = new Map<string, string[]>();

// Reflect the ACTIVE file's stack depths into reactive state (the toolbar's
// undo/redo buttons read these). Cheap + idempotent — call after any stack
// mutation or active-file change.
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
  redoStacks.delete(filename); // a new edit invalidates the redo branch
  publishHistory();
}

function clearHistory(filename: string): void {
  undoStacks.delete(filename);
  redoStacks.delete(filename);
  publishHistory();
}

// Undo the last visual edit on the active file. Returns false when there is
// nothing to undo.
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

// Format the ACTIVE buffer and reparse. Runs as part of every editor splice
// (see applySourceEdits); ops that span-match offsets after their splice
// (duplicate/move re-selection) pass `format: false` and call this AFTER the
// match — formatting shifts every offset, and the reparse re-anchors ids via
// the path mapping so the selection survives. No undo snapshot: the format is
// part of the op, and undoing back to the pre-op source is what users expect.
export async function formatActiveFile(): Promise<void> {
  const file = state.filename;
  if (!file || !state.source || state.error) return;
  const formatted = await formatUiSource(state.source);
  if (formatted === state.source) return;
  await loadAndParse(file, formatted);
}

// Apply source edits (from a visual op) to the active buffer, format, and
// reparse (+ persist to the scene folder). Pushes an undo snapshot of the
// pre-edit source; a refused edit (splice produced a syntax error → not saved)
// rolls the snapshot back off so undo never becomes a no-op entry.
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

// ---------------------------------------------------------------------------
// File-per-root management (src/ui/*.tsx + generated src/ui/index.tsx).
// ---------------------------------------------------------------------------

// Key includes topLevel so a promote/demote (not just an add/remove) is seen as
// a change by the poll and triggers an aggregator regen.
const rootsKey = (rs: readonly CodeRoot[]): string =>
  rs.map(r => `${r.filename}:${r.topLevel ? 1 : 0}`).join('|');

// Re-list src/ui/ and update `roots` (only when the set actually changed, so the
// 1s watcher poll doesn't re-render the tree every tick). Excludes the generated
// index.tsx. topLevel is carried forward for known files (cheap poll) and read
// from the `@ui-component` marker only for a newly-appeared file — editor toggles
// update it directly (toggleTopLevel), so the only fresh read needed is discovery.
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
    entries = []; // dir doesn't exist yet
  }
  const prev = new Map(state.roots.map(r => [r.filename, r]));
  const roots: CodeRoot[] = [];
  for (const e of entries) {
    if (e.isDirectory || !e.name.endsWith(TSX) || e.name === 'index.tsx') continue;
    const name = e.name.slice(0, -TSX.length);
    // Reject files whose basename is not already a valid component identifier:
    // refreshRoots is a trust boundary (a scene may be shared/downloaded), and the
    // name flows verbatim into generated src/ui/index.tsx. toComponentName is the
    // same sanitizer createRoot/renameRoot use; a conforming name is a fixed point.
    if (toComponentName(name) !== name) continue;
    const filename = `${UI_DIR}/${e.name}`;
    const existing = prev.get(filename);
    const topLevel = existing
      ? existing.topLevel
      : !hasComponentMarker(await readFromDisk(filename));
    roots.push({ name, filename, topLevel });
  }
  roots.sort((a, b) => a.name.localeCompare(b.name));
  if (rootsKey(roots) !== rootsKey(state.roots)) set({ roots });
  return roots;
}

// (Re)generate the src/ui/index.tsx aggregator from the TOP-LEVEL roots only —
// components (marker present) render where they're nested, not standalone.
async function regenerateAggregator(roots: CodeRoot[]): Promise<void> {
  const top = roots.filter(r => r.topLevel);
  const src = generateUiIndex(top.map(r => ({ component: r.name, from: `./${r.name}` })));
  await writeToDisk(UI_INDEX, src);
}

// Ensure src/index.ts main() calls setupUi(). Best-effort + guarded: uncomment a
// commented //setupUi() (the stock scene template) and make sure the import
// exists; never inject into an unrecognized main().
async function ensureMainWired(): Promise<void> {
  const source = await readFromDisk(SCENE_ENTRY);
  if (!source) return; // no entry file to wire
  let next = source;

  // Uncomment a commented-out setupUi() call, if present.
  if (!/(^|\n)[ \t]*setupUi\s*\(\s*\)/.test(next)) {
    next = next.replace(/\/\/[ \t]*setupUi\s*\(\s*\)/, 'setupUi()');
  }
  // If we now call setupUi() but never import it, add the import.
  const callsSetup = /(^|\n)[ \t]*setupUi\s*\(\s*\)/.test(next);
  const importsSetup = /import\s*\{[^}]*\bsetupUi\b[^}]*\}\s*from\s*['"]\.\/ui['"]/.test(next);
  if (callsSetup && !importsSetup) {
    next = `import { setupUi } from './ui'\n${next}`;
  }

  if (next !== source) await writeToDisk(SCENE_ENTRY, next);
}

// Remove the stock single-file src/ui.tsx when we adopt the src/ui/ directory:
// `import … from './ui'` resolves the FILE before the DIRECTORY, so leaving it
// would make the scene preview silently use the empty stock file.
async function removeLegacySingleFile(): Promise<void> {
  const storage = getStorage();
  if (!storage) return;
  try {
    if (!(await storage.exists(LEGACY_UI_FILE))) return;
    const content = await readFromDisk(LEGACY_UI_FILE);
    // Preserve hand-authored UI: only delete outright when empty/whitespace (the
    // stock template). Non-empty content is backed up to src/ui.tsx.bak (write-new
    // + delete, since storage has no rename) so opening a scene never silently
    // destroys a valid layout the user may not have meant to migrate.
    if (content.trim() !== '') {
      await writeToDisk(`${LEGACY_UI_FILE}.bak`, content);
    }
    await storage.delete(LEGACY_UI_FILE);
  } catch {
    // ignore
  }
}

// Create a new root: write src/ui/<Name>.tsx, refresh + regenerate the
// aggregator, wire main(), then select it. Returns the resolved name.
async function createRootUnlocked(desiredName?: string): Promise<string> {
  const name = uniqueRootName(
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

// Make `filename` the active root (read + parse; do not persist — it's on disk).
export async function selectRootFile(filename: string): Promise<void> {
  const source = await readFromDisk(filename);
  if (!source) return;
  await loadAndParse(filename, source, { persist: false });
}

// Parse every root except `exceptFilename` and return the ones whose source
// references root `name` (imports it or renders `<Name />`).
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
      // unparseable file — can't be safely rewritten; treated as non-referrer
    }
  }
  return out;
}

// Delete a root file, regenerate the aggregator, and reselect another root.
// BLOCKED (no delete) when other roots still reference the component — a
// delete would leave them with a dangling import and break the scene build.
// Returns the referrer names when blocked, null when deleted.
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
  try {
    await storage.delete(filename);
  } catch {
    // ignore
  }
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
        bindingSurface: { variables: [], actions: [] },
        componentTrees: {},
      });
  }
  return null;
}

// Rename a root: rewrite the exported component identifier, write the new
// src/ui/<NewName>.tsx, delete the old file, RETARGET every referrer (other
// roots importing/rendering the component get their import + JSX spliced to the
// new name), regenerate the aggregator + wire, and reselect. Storage has no
// rename, so this is write-new + delete-old. The Label text / other literals
// containing the old name are untouched (we splice only identifier spans).
async function renameRootUnlocked(filename: string, desiredName: string): Promise<void> {
  const root = state.roots.find(r => r.filename === filename);
  if (!root) return;
  const newName = uniqueRootName(
    toComponentName(desiredName),
    state.roots.filter(r => r.filename !== filename).map(r => r.name),
  );
  if (newName === root.name) return; // no-op (same name, or only case/space diff resolved back)

  const source = filename === state.filename ? state.source : await readFromDisk(filename);
  if (!source) return;
  const parser = getCodeParser();
  if (!parser) return;
  const { program } = await parser.parse(filename, source);
  const idSpan = findComponentIdSpan(
    program as Parameters<typeof findComponentIdSpan>[0],
    root.name,
  );
  if (!idSpan) return; // non-conforming file — leave it alone

  // Collect referrers BEFORE the delete so their sources still parse against
  // the old on-disk state.
  const referrers = await findReferrers(root.name, filename);

  const renamed = source.slice(0, idSpan.start) + newName + source.slice(idSpan.end);
  const newFilename = `${UI_DIR}/${newName}${TSX}`;
  await writeToDisk(newFilename, renamed);

  const storage = getStorage();
  try {
    if (storage) await storage.delete(filename);
  } catch {
    // ignore
  }
  clearHistory(filename); // history keyed by the old path would strand

  // Retarget referrers: import source ('./Old' → './New'), imported specifier,
  // and (for unaliased imports) the JSX element names.
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

// ---------------------------------------------------------------------------
// Disk watcher: reflect external edits (VSCode / vim / Notepad) onto the canvas.
// Polls the active root file for content changes and the src/ui/ dir for
// added/removed roots. Our own writes land asynchronously (fire-and-forget, after
// the parse), so a `pendingWrites` guard makes pollDisk skip content
// reconciliation while a local write is in flight — during that window disk still
// holds the OLD content while state.source holds the NEW, and reparsing stale
// disk would clobber the fresh canvas edit.
// ---------------------------------------------------------------------------

let watchTimer: ReturnType<typeof setInterval> | null = null;
let polling = false;
let pendingWrites = 0;

async function pollDisk(): Promise<void> {
  if (polling) return;
  polling = true;
  try {
    // 1. External edits to the active root file → reparse (do not re-persist).
    //    Skip while a local write is in flight: during that window disk still holds
    //    the OLD content while state.source holds the NEW, so a naive disk !=
    //    state.source check would reparse stale disk and clobber the fresh edit.
    const file = state.filename;
    if (file && pendingWrites === 0) {
      const disk = await readFromDisk(file);
      if (disk && disk !== state.source) {
        // An external editor changed the file — its editor owns that history;
        // mixing timelines would let our undo silently revert external work.
        clearHistory(file);
        await loadAndParse(file, disk, { persist: false });
      }
    }
    // 2. Roots added/removed externally → refresh the list + keep the aggregator
    //    in sync so the new/removed root renders (or stops rendering) in-scene.
    const prev = rootsKey(state.roots);
    const roots = await refreshRoots();
    if (rootsKey(roots) !== prev) await regenerateAggregator(roots);
    // 3. Nested-component previews: re-resolve so an external edit to a referenced
    //    root reflects live inside the block. Cheap when unchanged (cached parse +
    //    a no-op set skip); only re-renders when a referenced file actually moved.
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

// Bootstrap code-mode for the current scene: adopt the src/ui/ directory layout.
// If it's empty, seed one starter root; otherwise sync the aggregator/wiring and
// open the first root. Then start the disk watcher. Runs once.
export function bootstrapCodeMode(): void {
  if (bootstrapped) return;
  bootstrapped = true;
  void (async () => {
    const roots = await refreshRoots();
    await removeLegacySingleFile();
    if (roots.length === 0) {
      await createRoot('MainUI');
    } else {
      await regenerateAggregator(roots);
      await ensureMainWired();
      await selectRootFile(roots[0].filename);
    }
    startWatching();
  })();
}

// ---------------------------------------------------------------------------
// Read helpers (PropertyPanel / canvas node lookup).
// ---------------------------------------------------------------------------

// Look up the backing AST node for a code-mode UINode (by its synthetic id).
function astNodeFor(entityId: number): unknown | undefined {
  return state.parsed?.astNodes.get(entityId);
}

// Find a node in the parsed tree by its synthetic id (for PropertyPanel, which
// needs the selected node's component values to populate its fields).
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

// The PB-shaped component value the panel reads for a given SDK component id.
// (uiTransform is already normalized to PB by the parse adapter.)
export function codeComponentValue(
  node: CodeUINode | undefined,
  componentId: string,
): Record<string, unknown> | null {
  if (!node) return null;
  switch (componentId) {
    case 'core::UiTransform':
      return (node.uiTransform as Record<string, unknown>) ?? null;
    case 'core::UiBackground':
      return (node.uiBackground as Record<string, unknown>) ?? null;
    case 'core::UiText':
      return (node.uiText as Record<string, unknown>) ?? null;
    case 'core::UiInput':
      return (node.uiInput as Record<string, unknown>) ?? null;
    case 'core::UiDropdown':
      return (node.uiDropdown as Record<string, unknown>) ?? null;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Write helpers (canvas / panel visual ops → source splices).
// ---------------------------------------------------------------------------

// Gate for the element-prop write paths (uiTransform/uiBackground/…):
// - A node whose props contain values the parser could not statically evaluate
//   (a `state.x` binding, a spread) — the parsed model is LOSSY for those, and
//   a re-emit would erase them from source.
// - A component-ref instance — `<Name />` accepts only its DECLARED props;
//   writing uiTransform onto it emits code its props type rejects (scene
//   typecheck error). Position/size the instance via its wrapper UiEntity.
// - An opaque node — not a representable element at all.
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
  if (node?.dynamicProps) {
    console.warn(
      `[code-mode] ${opName}: node has dynamic props (bindings/spreads in uiTransform or uiBackground) — edit it in code instead`,
    );
    return false;
  }
  return true;
}

// Route a PropertyPanel component patch to source splices. Writes are SURGICAL:
// only the ergonomic keys the patch touches are spliced — hand-authored props
// the editor doesn't model survive byte-for-byte.
async function spliceComponentPatchUnlocked(
  entityId: number,
  componentId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const ast = astNodeFor(entityId) as Parameters<typeof setObjectField>[0] | undefined;
  if (!ast) return;
  const edits: Edit[] = [];

  if (componentId === 'core::UiTransform') {
    // The panel patches flattened PB fields (dimensions + units, positionType,
    // position/margin/padding edges, border groups, opacity/zIndex). Each
    // touched flattened key maps to one ergonomic uiTransform key, recomputed
    // from the node's current PB merged with the patch (transform-patch.ts).
    if (!guardElementWrite(entityId, 'spliceComponentPatch')) return;
    const node = findCodeNode(state.parsed?.root, entityId);
    const current = (node?.uiTransform as Record<string, unknown>) ?? {};
    edits.push(...uiTransformPatchEdits(ast, current, patch));
  } else if (componentId === 'core::UiBackground') {
    if (!guardElementWrite(entityId, 'spliceComponentPatch')) return;
    // Per-key surgical writes; PB shapes (TextureUnion, numeric enums) convert
    // back to the ergonomic react-ecs form. A PB texture variant that react-ecs
    // can't express (videoTexture) is skipped with a warning.
    const fields: Record<string, unknown> = {};
    for (const key of ['color', 'texture', 'textureMode', 'textureSlices', 'uvs']) {
      if (!(key in patch)) continue;
      const ergo = pbBackgroundFieldToErgo(key, patch[key]);
      if (!ergo) {
        console.warn(
          `[code-mode] uiBackground.${key}: value not expressible in react-ecs — skipped`,
        );
        continue;
      }
      // Switching (or clearing) the texture kind must clear the other
      // variant's ergonomic prop — react-ecs applies whichever is present.
      if (ergo.key === 'texture' || ergo.key === 'avatarTexture') {
        fields.texture = undefined;
        fields.avatarTexture = undefined;
      }
      fields[ergo.key] = ergo.value;
    }
    if (Object.keys(fields).length) edits.push(...setObjectFields(ast, 'uiBackground', fields));
  } else if (
    componentId === 'core::UiText' ||
    componentId === 'core::UiInput' ||
    componentId === 'core::UiDropdown'
  ) {
    // Text / Input / Dropdown props are top-level JSX attributes, not a nested
    // object. The panel patches the PB numeric enums for textAlign/font;
    // convert them back to the ergonomic strings react-ecs expects before
    // emitting (every other prop is the same shape on both sides).
    const ergo = pbToErgonomicText(patch);
    for (const key of Object.keys(ergo)) {
      // An undefined value means "unset this prop" (a panel Remove/−) → delete
      // the JSX attribute; any other value writes/replaces it.
      if (ergo[key] === undefined) edits.push(...removeAttribute(ast, state.source, key));
      else edits.push(...setAttribute(ast, key, ergo[key]));
    }
  }

  if (edits.length) await applySourceEdits(edits);
}

// Splice a resize (width/height, top-level ergonomic uiTransform fields) into
// the source and reparse. One setObjectFields call: both fields compose against
// the same AST pass (two separate calls would emit a duplicate attribute when
// uiTransform is absent, or a comma-less pair when it's `{{}}`).
async function spliceUiTransformSizeUnlocked(
  entityId: number,
  width: number,
  height: number,
): Promise<void> {
  const ast = astNodeFor(entityId) as Parameters<typeof setObjectField>[0] | undefined;
  if (!ast || !guardElementWrite(entityId, 'spliceUiTransformSize')) return;
  await applySourceEdits(setObjectFields(ast, 'uiTransform', { width, height }));
}

// Move an ABSOLUTE node: splice the ergonomic `position: { top, left }` edges.
// (Only used for nodes already positionType:'absolute' — the canvas moves in-flow
// nodes via margin instead, see spliceUiTransformMargin.)
async function spliceUiTransformPositionUnlocked(
  entityId: number,
  top: number,
  left: number,
): Promise<void> {
  const ast = astNodeFor(entityId) as Parameters<typeof setObjectField>[0] | undefined;
  if (!ast || !guardElementWrite(entityId, 'spliceUiTransformPosition')) return;
  await applySourceEdits(setObjectField(ast, 'uiTransform', 'position', { top, left }));
}

// Move an IN-FLOW node without leaving the flow: splice the ergonomic
// `margin: { top, left }` (the caller passes current margin + drag delta). Keeps
// the node responsive (laid out by the parent) rather than converting it to
// absolute. Note: margin offsets the node from its flow origin, so elements
// after it in the flow shift accordingly.
async function spliceUiTransformMarginUnlocked(
  entityId: number,
  top: number,
  left: number,
): Promise<void> {
  const ast = astNodeFor(entityId) as Parameters<typeof setObjectField>[0] | undefined;
  if (!ast || !guardElementWrite(entityId, 'spliceUiTransformMargin')) return;
  await applySourceEdits(setObjectField(ast, 'uiTransform', 'margin', { top, left }));
}

// Resize a node: write width/height AND its new top-left in ONE setObjectFields
// pass (one AST pass — two calls would corrupt an absent/`{{}}` uiTransform, see
// spliceUiTransformSize). Absolute nodes reposition via `position: { top, left }`;
// in-flow nodes shift via `margin: { top, left }` (mirroring the move path) so a
// drag from the left/top edge grows the box toward that edge instead of always
// to the right/bottom.
async function spliceUiTransformResizeUnlocked(
  entityId: number,
  opts: {
    position?: { top: number; left: number };
    margin?: { top: number; left: number };
    width: number;
    height: number;
  },
): Promise<void> {
  const ast = astNodeFor(entityId) as Parameters<typeof setObjectField>[0] | undefined;
  if (!ast || !guardElementWrite(entityId, 'spliceUiTransformResize')) return;
  const fields: Record<string, unknown> = { width: opts.width, height: opts.height };
  if (opts.position) fields.position = opts.position;
  if (opts.margin) fields.margin = opts.margin;
  await applySourceEdits(setObjectFields(ast, 'uiTransform', fields));
}

// Seed JSX per widget type — each palette entry inserts its REAL react-ecs
// element (an Input drop must produce `<Input …/>`, not a container). Every
// react-ecs element accepts EntityPropTypes (uiTransform/uiBackground/mouse
// events), so each template seeds a uiTransform — the dropped widget is
// immediately sized, movable, and resizable.
const CHILD_TEMPLATES: Record<UINodeType, string> = {
  UiEntity:
    '<UiEntity uiTransform={{ width: 200, height: 100 }} uiBackground={{ color: { r: 1, g: 1, b: 1, a: 0.1 } }} />',
  Label: '<Label value="Label" fontSize={24} uiTransform={{ width: 200, height: 36 }} />',
  Button: '<Button value="Button" fontSize={18} uiTransform={{ width: 160, height: 44 }} />',
  Input: '<Input placeholder="Type here" fontSize={18} uiTransform={{ width: 240, height: 44 }} />',
  Dropdown:
    "<Dropdown options={['Option 1', 'Option 2']} fontSize={18} uiTransform={{ width: 240, height: 44 }} />",
};

// The Image preset: a container seeded texture-ready (opaque white tint +
// stretch) so picking a file in the panel's Texture field lights it up.
const IMAGE_TEMPLATE =
  "<UiEntity uiTransform={{ width: 200, height: 200 }} uiBackground={{ color: { r: 1, g: 1, b: 1, a: 1 }, textureMode: 'stretch' }} />";

// Insert a new child element of the given type (or creation preset) into a
// parent node.
async function spliceAddChildUnlocked(
  parentEntityId: number,
  type: UINodeType,
  preset?: 'image',
): Promise<void> {
  const ast = astNodeFor(parentEntityId) as Parameters<typeof insertChild>[0] | undefined;
  // A component instance doesn't render arbitrary children — refuse the drop
  // (guardElementWrite also covers opaque/dynamic parents).
  if (!ast || !guardElementWrite(parentEntityId, 'spliceAddChild')) return;
  const jsx =
    preset === 'image' ? IMAGE_TEMPLATE : (CHILD_TEMPLATES[type] ?? CHILD_TEMPLATES.UiEntity);
  // Ensure the element's react-ecs identifier is imported — a spliced `<Button/>`
  // whose `Button` isn't in the import block won't compile. `type` is the tag name
  // for every widget (UiEntity/Label/Button/Input/Dropdown); the `image` preset
  // resolves to `UiEntity` via `type`. Mirrors the component-nesting import step.
  const edits = [...insertChild(ast, state.source, jsx)];
  if (state.program) {
    edits.push(...ensureNamedImport(state.program as any, type, '@dcl/sdk/react-ecs'));
  }
  await applySourceEdits(edits);
}

// ---------------------------------------------------------------------------
// Component nesting: use another editor root as a component inside the active
// one (`<OtroNOmbre />`). See code/component-graph.ts (cycle guard) +
// code/component-marker.ts (top-level toggle).
// ---------------------------------------------------------------------------

// Build the root→referenced-roots adjacency by parsing every root. Used only by
// the cycle guard at drop time (a discrete action), so the read+parse cost of a
// handful of files is fine.
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

// Whether nesting `childName` inside `parentRootName` is safe (no reference
// cycle — react-ecs would infinite-recurse at runtime otherwise).
export async function canNest(parentRootName: string, childName: string): Promise<boolean> {
  if (parentRootName === childName) return false;
  const refs = await buildReferenceGraph();
  return !wouldCycle(refs, parentRootName, childName);
}

// Nest a component: splice `<Name />` as a child of the parent node and ensure
// `import { Name } from './Name'`. No-ops (with a warning) if it would cycle.
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
  // Wrap the reference in a positioning UiEntity so the INSTANCE can be moved and
  // resized on the canvas. A bare `<Name />` carries no uiTransform of its own —
  // the component owns its root transform, which is shared by every use, so
  // writing a transform there would move/scale ALL instances. The wrapper is a
  // normal node the canvas already drags/resizes; the component fills it.
  const childJsx = `<UiEntity uiTransform={{ width: 200, height: 120 }}>\n  <${componentName} />\n</UiEntity>`;
  const edits = [
    ...insertChild(ast, state.source, childJsx),
    ...ensureNamedImport(state.program as any, componentName, `./${componentName}`),
  ];
  await applySourceEdits(edits);
}

// Set a prop VALUE on a component-ref instance — splice the JSX attribute
// (`<Name prop={value} />`) on the reference element, coercing `rawValue` to the
// declared type. This is the per-instance counterpart to declaring the prop on
// the component (addBindProp).
async function spliceInstancePropUnlocked(
  entityId: number,
  name: string,
  type: string,
  rawValue: string,
): Promise<void> {
  const ast = astNodeFor(entityId) as Parameters<typeof setAttribute>[0] | undefined;
  if (!ast) return;
  // A non-primitive declared prop type can't be represented by a coerced
  // literal — writing one would corrupt a hand-authored value (e.g. a
  // function). The panel renders these read-only; this is the backstop.
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

// Clear a prop on the instance (remove its JSX attribute → the prop falls back
// to whatever default the component applies).
async function unsetInstancePropUnlocked(entityId: number, name: string): Promise<void> {
  const ast = astNodeFor(entityId) as Parameters<typeof removeAttribute>[0] | undefined;
  if (!ast) return;
  await applySourceEdits(removeAttribute(ast, state.source, name));
}

// Toggle a root between top-level (aggregated screen) and component (nested-only):
// splice the `/** @ui-component */` marker in/out, update the root list, and
// regenerate the aggregator.
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
  // Marker PRESENT when it becomes a component (i.e. NOT top-level).
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

// Delete a node (or opaque block) by removing its source span.
async function spliceRemoveNodeUnlocked(entityId: number): Promise<void> {
  const ast = astNodeFor(entityId) as Parameters<typeof removeNode>[0] | undefined;
  if (!ast) return;
  await applySourceEdits(removeNode(ast));
}

// Move a node's element to a new location — the code equivalent of
// reorderUISibling / setUIParent. `after`/`before` reorder relative to a sibling
// (works across parents too); `into` reparents as the last child of the target.
export type MoveAnchor = { kind: 'after' | 'before' | 'into'; targetId: number };

async function spliceMoveUnlocked(entityId: number, anchor: MoveAnchor): Promise<void> {
  const el = astNodeFor(entityId) as
    | (Parameters<typeof removeNode>[0] & Record<string, any>)
    | undefined;
  const target = astNodeFor(anchor.targetId) as
    | (Parameters<typeof insertChild>[0] & Record<string, any>)
    | undefined;
  if (!el || !target || anchor.targetId === entityId) return;
  // Never move an element into itself or one of its own descendants.
  if (target.start >= el.start && target.end <= el.end) return;
  // Never move a node INTO a component instance — `<Name />` doesn't render
  // arbitrary children (store-level backstop; the tree also blocks the drop).
  if (anchor.kind === 'into') {
    const targetNode = findCodeNode(state.parsed?.root, anchor.targetId);
    if (targetNode?.componentRef) {
      console.warn('[code-mode] cannot nest children inside a component instance');
      return;
    }
  }

  const elLen = el.end - el.start;
  // Where the moved element's text will START in the post-edit source — the
  // insertion offset adjusted for the removal of the element's own span when
  // that span precedes the insertion point. Mirrors moveElement/insertChild's
  // text layout (leading '\n' when moving forward; '>\n  ' when converting a
  // self-closing parent).
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

  // Re-select the moved node: the generic path re-anchor can't follow a
  // structural move (its path changed on purpose), so span-match the expected
  // start offset — the same technique spliceDuplicate uses. Splice runs
  // UNFORMATTED so the offset math holds; format afterwards (the reparse
  // re-anchors the selection via the path mapping).
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

// Duplicate a node: insert a verbatim copy of its source immediately after it
// (as a following sibling) — the code equivalent of duplicateUINode. Returns the
// new clone's synthetic id (or null). Parse ids are assigned in source order and
// the copy's JSX starts one char past the original (after the inserted '\n'), so
// after the reparse the clone is the node whose span begins at that offset.
async function spliceDuplicateUnlocked(entityId: number): Promise<number | null> {
  const el = astNodeFor(entityId) as Parameters<typeof removeNode>[0] | undefined;
  if (!el) return null;
  const raw = state.source.slice(el.start, el.end);
  const cloneStart = el.end + 1; // just after the inserted leading '\n'
  // Splice UNFORMATTED so the clone's expected offset stays valid for the
  // span-match below; format afterwards (the reparse re-anchors the id).
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

// Bind a top-level attribute to a variable/handler expression — `value={score}`,
// `onMouseDown={onStart}` — the @ui-bind / @ui-action write path.
async function bindAttributeUnlocked(entityId: number, name: string, expr: string): Promise<void> {
  const ast = astNodeFor(entityId) as Parameters<typeof setAttributeExpr>[0] | undefined;
  if (!ast) return;
  await applySourceEdits(setAttributeExpr(ast, name, expr));
}

// Unbind a top-level attribute: remove it entirely so the field reverts to
// unset (the author can then type a literal). The code equivalent of the classic
// unbindField op.
async function unbindAttributeUnlocked(entityId: number, name: string): Promise<void> {
  const ast = astNodeFor(entityId) as Parameters<typeof removeAttribute>[0] | undefined;
  if (!ast) return;
  await applySourceEdits(removeAttribute(ast, state.source, name));
}

// Write a mixed-content attribute (literal text interleaved with variable
// expressions) as a template literal, e.g. `value={`Score: ${state.score}`}`. An
// all-literal list collapses to a plain string; a single binding to a bare
// expression (see emit-adapter setAttributeSegments).
async function setMixedContentAttributeUnlocked(
  entityId: number,
  name: string,
  segments: { kind: string; value: string }[],
): Promise<void> {
  const ast = astNodeFor(entityId) as Parameters<typeof setAttributeSegments>[0] | undefined;
  if (!ast) return;
  await applySourceEdits(setAttributeSegments(ast, name, segments));
}

// Ensure the typed `state` scaffold exists (`export interface State {}` +
// `export const state: State = {}`), seeding it after the imports if absent.
// `as any` matches the existing adapter style (cf. `result.comments as any`).
async function ensureStateScaffold(): Promise<void> {
  if (!state.program) return;
  if (findStateNodes(state.program as any).object) return;
  const at = afterImports(state.program as any);
  await applySourceEdits([
    { start: at, end: at, text: '\n\nexport interface State {}\nexport const state: State = {}' },
  ]);
}

// Add a bindable variable to the typed `state` object (seeding the scaffold first
// if absent), then reparse. `rawDefault` (optional) is the user-entered default;
// omitted → the type's zero default. The surface then includes `state.<name>`.
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

// Set a state variable's default value (splices its object initializer).
async function setStateVariableValueUnlocked(
  name: string,
  type: string,
  rawDefault: string,
): Promise<void> {
  if (!state.program) return;
  const edits = setStatePropertyValue(state.program as any, name, type, rawDefault);
  if (edits.length) await applySourceEdits(edits);
}

// Add an event-handler callback: seed a top-level `/** @ui-action */ function
// <name>(state: State, value?) {}`. Taking `state` as a PARAMETER (rather than
// closing over the module const) keeps the handler a pure function of state and
// avoids use-before-declaration when it's emitted above the `state` const.
// `value` carries the event payload — Input.onChange/onSubmit deliver the typed
// text and Dropdown.onChange the selected index; mouse events leave it
// undefined. It appears in the callbacks panel and binds to an event via a
// thunk (`onChange={(value) => <name>(state, value)}`). ensureStateScaffold
// runs first so the `State` param type exists.
async function addBindActionUnlocked(name: string): Promise<void> {
  await ensureStateScaffold();
  if (!state.program) return;
  const at = afterImports(state.program as any);
  await applySourceEdits([
    {
      start: at,
      end: at,
      text: `\n\n/** @ui-action */\nfunction ${name}(state: State, value?: string | number) {}`,
    },
  ]);
}

// Remove an entire callback handler (function + its @ui-action comment).
async function removeActionUnlocked(name: string): Promise<void> {
  if (!state.program) return;
  const edits = removeActionDecl(state.program as any, name, lastComments as any, state.source);
  if (edits.length) await applySourceEdits(edits);
}

// Set a handler's whole body from a `{{ var }}` template: resolve each
// placeholder to the variable's expression, then splice the body. props are out
// of scope in a handler, so they're excluded from the resolvable set.
async function setActionBodyUnlocked(name: string, template: string): Promise<void> {
  if (!state.program) return;
  const code = templateToBody(template, callbackVars(state.bindingSurface.variables));
  const edits = setActionBodyEdit(state.program as any, name, code);
  if (edits.length) await applySourceEdits(edits);
}

// Remove a variable from the typed `state` object (+ its interface member).
async function removeStateVariableUnlocked(name: string): Promise<void> {
  if (!state.program) return;
  const edits = removeStateProperty(state.program as any, name);
  if (edits.length) await applySourceEdits(edits);
}

// Change a state variable's type (rewrites the interface member type and resets
// the initializer to the new type's default).
async function retypeStateVariableUnlocked(name: string, type: string): Promise<void> {
  if (!state.program) return;
  const edits = setStatePropertyType(state.program as any, name, type);
  if (edits.length) await applySourceEdits(edits);
}

// The active root's own component name — props attach to its function signature.
function activeComponentName(): string | undefined {
  return state.roots.find(r => r.filename === state.filename)?.name;
}

// Declare a prop on the active component (seeding the `props: {}` parameter when
// absent). It then appears as `props.<name>` in the field-binding surface, and a
// nested instance can set its value (see spliceInstanceProp).
async function addBindPropUnlocked(name: string, type: string): Promise<void> {
  const cn = activeComponentName();
  if (!state.program || !cn) return;
  const edits = addPropsProperty(state.program as any, state.source, cn, name, propTypeToTs(type));
  if (edits.length) await applySourceEdits(edits);
}

// Remove a prop from the active component's props type.
async function removePropUnlocked(name: string): Promise<void> {
  const cn = activeComponentName();
  if (!state.program || !cn) return;
  const edits = removePropsProperty(state.program as any, cn, name);
  if (edits.length) await applySourceEdits(edits);
}

// Change a prop's type.
async function retypePropUnlocked(name: string, type: string): Promise<void> {
  const cn = activeComponentName();
  if (!state.program || !cn) return;
  const edits = setPropsPropertyType(state.program as any, cn, name, propTypeToTs(type));
  if (edits.length) await applySourceEdits(edits);
}

// ---------------------------------------------------------------------------
// Public mutating API — every op is serialized through the exclusive queue
// (see `exclusive` above). Add new mutating ops HERE, not as bare exports.
// ---------------------------------------------------------------------------
export const undoCode = exclusive(undoCodeUnlocked);
export const redoCode = exclusive(redoCodeUnlocked);
export const createRoot = exclusive(createRootUnlocked);
export const removeRoot = exclusive(removeRootUnlocked);
export const renameRoot = exclusive(renameRootUnlocked);
export const toggleTopLevel = exclusive(toggleTopLevelUnlocked);
export const spliceComponentPatch = exclusive(spliceComponentPatchUnlocked);
export const spliceUiTransformSize = exclusive(spliceUiTransformSizeUnlocked);
export const spliceUiTransformPosition = exclusive(spliceUiTransformPositionUnlocked);
export const spliceUiTransformMargin = exclusive(spliceUiTransformMarginUnlocked);
export const spliceUiTransformResize = exclusive(spliceUiTransformResizeUnlocked);
export const spliceAddChild = exclusive(spliceAddChildUnlocked);
export const spliceInsertComponent = exclusive(spliceInsertComponentUnlocked);
export const spliceInstanceProp = exclusive(spliceInstancePropUnlocked);
export const unsetInstanceProp = exclusive(unsetInstancePropUnlocked);
export const spliceRemoveNode = exclusive(spliceRemoveNodeUnlocked);
export const spliceMove = exclusive(spliceMoveUnlocked);
export const spliceDuplicate = exclusive(spliceDuplicateUnlocked);
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
