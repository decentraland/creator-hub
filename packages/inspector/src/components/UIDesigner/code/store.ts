import { useSyncExternalStore } from 'react';

import { getCodeParser } from '../../../lib/logic/code-parser/iframe';
import { getStorage } from '../../../lib/data-layer/client/iframe-data-layer';
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
  type PropVar,
  readPropsVariables,
  removePropsProperty,
  setPropsPropertyType,
} from './props-convention';
import { collectComponentRefNames, wouldCycle } from './component-graph';
import { componentMarkerEdit, hasComponentMarker } from './component-marker';
import {
  afterImports,
  applyEdits,
  type Edit,
  emitElement,
  ensureNamedImport,
  insertChild,
  moveElement,
  removeAttribute,
  removeNode,
  setAttribute,
  setAttributeExpr,
  setAttributeSegments,
  setObjectField,
} from './emit-adapter';
import { pbToErgonomicText, pbToErgonomicTransform } from './ecs-shape';
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
  // Props are bindable INSIDE the component render; they carry no default value.
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

// Apply source edits (from a visual op) to the active buffer and reparse (+
// persist to the scene folder).
export async function applySourceEdits(edits: Edit[]): Promise<string> {
  const file = state.filename;
  if (!file) return state.source;
  const next = applyEdits(state.source, edits);
  await loadAndParse(file, next);
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
export async function createRoot(desiredName?: string): Promise<string> {
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

// Delete a root file, regenerate the aggregator, and reselect another root.
export async function removeRoot(filename: string): Promise<void> {
  const storage = getStorage();
  if (!storage) return;
  try {
    await storage.delete(filename);
  } catch {
    // ignore
  }
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
}

// Rename a root: rewrite the exported component identifier, write the new
// src/ui/<NewName>.tsx, delete the old file, regenerate the aggregator + wire,
// and reselect. Storage has no rename, so this is write-new + delete-old. The
// Label text / other literals containing the old name are untouched (we splice
// only the declaration identifier's span).
export async function renameRoot(filename: string, desiredName: string): Promise<void> {
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

  const renamed = source.slice(0, idSpan.start) + newName + source.slice(idSpan.end);
  const newFilename = `${UI_DIR}/${newName}${TSX}`;
  await writeToDisk(newFilename, renamed);

  const storage = getStorage();
  try {
    if (storage) await storage.delete(filename);
  } catch {
    // ignore
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
      if (disk && disk !== state.source) await loadAndParse(file, disk, { persist: false });
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

// Route a PropertyPanel component patch to source splices.
export async function spliceComponentPatch(
  entityId: number,
  componentId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const ast = astNodeFor(entityId) as Parameters<typeof setObjectField>[0] | undefined;
  if (!ast) return;
  const edits: Edit[] = [];

  if (componentId === 'core::UiTransform') {
    // The panel patches flattened PB fields (dimensions + units, positionType,
    // position/margin/padding edges). Re-emit the whole ergonomic uiTransform
    // from the node's current PB merged with the patch, so enums, units, and
    // nested edges all round-trip (not just bare-number dimensions). The
    // synthetic `parent` (structural, from JSX nesting) is never emitted.
    const node = findCodeNode(state.parsed?.root, entityId);
    const merged = { ...((node?.uiTransform as Record<string, unknown>) ?? {}), ...patch };
    delete merged.parent;
    edits.push(...setAttribute(ast, 'uiTransform', pbToErgonomicTransform(merged)));
  } else if (componentId === 'core::UiBackground') {
    if (patch.color !== undefined)
      edits.push(...setObjectField(ast, 'uiBackground', 'color', patch.color));
  } else if (componentId === 'core::UiText') {
    // Label text props are top-level JSX attributes, not a nested object. The
    // panel patches the PB numeric enums for textAlign/font; convert them back
    // to the ergonomic strings react-ecs's <Label> expects before emitting
    // (value/fontSize/color are the same shape on both sides).
    const ergo = pbToErgonomicText(patch);
    for (const key of ['value', 'fontSize', 'color', 'textAlign', 'font']) {
      if (ergo[key] !== undefined) edits.push(...setAttribute(ast, key, ergo[key]));
    }
  }

  if (edits.length) await applySourceEdits(edits);
}

// Splice a resize (width/height, top-level ergonomic uiTransform fields) into
// the source and reparse.
export async function spliceUiTransformSize(
  entityId: number,
  width: number,
  height: number,
): Promise<void> {
  const ast = astNodeFor(entityId) as Parameters<typeof setObjectField>[0] | undefined;
  if (!ast) return;
  const edits: Edit[] = [
    ...setObjectField(ast, 'uiTransform', 'width', width),
    ...setObjectField(ast, 'uiTransform', 'height', height),
  ];
  await applySourceEdits(edits);
}

// Move an ABSOLUTE node: splice the ergonomic `position: { top, left }` edges.
// (Only used for nodes already positionType:'absolute' — the canvas moves in-flow
// nodes via margin instead, see spliceUiTransformMargin.)
export async function spliceUiTransformPosition(
  entityId: number,
  top: number,
  left: number,
): Promise<void> {
  const ast = astNodeFor(entityId) as Parameters<typeof setObjectField>[0] | undefined;
  if (!ast) return;
  await applySourceEdits(setObjectField(ast, 'uiTransform', 'position', { top, left }));
}

// Move an IN-FLOW node without leaving the flow: splice the ergonomic
// `margin: { top, left }` (the caller passes current margin + drag delta). Keeps
// the node responsive (laid out by the parent) rather than converting it to
// absolute. Note: margin offsets the node from its flow origin, so elements
// after it in the flow shift accordingly.
export async function spliceUiTransformMargin(
  entityId: number,
  top: number,
  left: number,
): Promise<void> {
  const ast = astNodeFor(entityId) as Parameters<typeof setObjectField>[0] | undefined;
  if (!ast) return;
  await applySourceEdits(setObjectField(ast, 'uiTransform', 'margin', { top, left }));
}

// Insert a new child element of the given type into a parent node.
export async function spliceAddChild(parentEntityId: number, type: UINodeType): Promise<void> {
  const ast = astNodeFor(parentEntityId) as Parameters<typeof insertChild>[0] | undefined;
  if (!ast) return;
  const node =
    type === 'Label'
      ? { type: 'Label' as const, uiText: { value: 'Label', fontSize: 24 } }
      : {
          type: 'UiEntity' as const,
          uiTransform: { width: 200, height: 100 },
          uiBackground: { color: { r: 1, g: 1, b: 1, a: 0.1 } },
        };
  await applySourceEdits(insertChild(ast, state.source, emitElement(node)));
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
export async function spliceInsertComponent(
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
export async function spliceInstanceProp(
  entityId: number,
  name: string,
  type: string,
  rawValue: string,
): Promise<void> {
  const ast = astNodeFor(entityId) as Parameters<typeof setAttribute>[0] | undefined;
  if (!ast) return;
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
export async function unsetInstanceProp(entityId: number, name: string): Promise<void> {
  const ast = astNodeFor(entityId) as Parameters<typeof removeAttribute>[0] | undefined;
  if (!ast) return;
  await applySourceEdits(removeAttribute(ast, state.source, name));
}

// Toggle a root between top-level (aggregated screen) and component (nested-only):
// splice the `/** @ui-component */` marker in/out, update the root list, and
// regenerate the aggregator.
export async function toggleTopLevel(filename: string): Promise<void> {
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
    if (isActive) await loadAndParse(filename, next);
    else await writeToDisk(filename, next);
  }
  const roots = state.roots.map(r =>
    r.filename === filename ? { ...r, topLevel: newTopLevel } : r,
  );
  set({ roots });
  await regenerateAggregator(roots);
}

// Delete a node (or opaque block) by removing its source span.
export async function spliceRemoveNode(entityId: number): Promise<void> {
  const ast = astNodeFor(entityId) as Parameters<typeof removeNode>[0] | undefined;
  if (!ast) return;
  await applySourceEdits(removeNode(ast));
}

// Move a node's element to a new location — the code equivalent of
// reorderUISibling / setUIParent. `after`/`before` reorder relative to a sibling
// (works across parents too); `into` reparents as the last child of the target.
export type MoveAnchor = { kind: 'after' | 'before' | 'into'; targetId: number };

export async function spliceMove(entityId: number, anchor: MoveAnchor): Promise<void> {
  const el = astNodeFor(entityId) as Parameters<typeof removeNode>[0] | undefined;
  const target = astNodeFor(anchor.targetId) as Parameters<typeof insertChild>[0] | undefined;
  if (!el || !target || anchor.targetId === entityId) return;
  // Never move an element into itself or one of its own descendants.
  if (target.start >= el.start && target.end <= el.end) return;

  let edits: Edit[];
  if (anchor.kind === 'into') {
    const raw = state.source.slice(el.start, el.end);
    edits = [...removeNode(el), ...insertChild(target, state.source, raw)];
  } else {
    edits = moveElement(state.source, el, anchor.kind === 'after' ? target.end : target.start);
  }
  await applySourceEdits(edits);
}

// Duplicate a node: insert a verbatim copy of its source immediately after it
// (as a following sibling) — the code equivalent of duplicateUINode. Returns the
// new clone's synthetic id (or null). Parse ids are assigned in source order and
// the copy's JSX starts one char past the original (after the inserted '\n'), so
// after the reparse the clone is the node whose span begins at that offset.
export async function spliceDuplicate(entityId: number): Promise<number | null> {
  const el = astNodeFor(entityId) as Parameters<typeof removeNode>[0] | undefined;
  if (!el) return null;
  const raw = state.source.slice(el.start, el.end);
  const cloneStart = el.end + 1; // just after the inserted leading '\n'
  await applySourceEdits([{ start: el.end, end: el.end, text: `\n${raw}` }]);
  const spans = state.parsed?.spans;
  if (!spans) return null;
  for (const [id, span] of spans) {
    if (span[0] === cloneStart) return id;
  }
  return null;
}

// Bind a top-level attribute to a variable/handler expression — `value={score}`,
// `onMouseDown={onStart}` — the @ui-bind / @ui-action write path.
export async function bindAttribute(entityId: number, name: string, expr: string): Promise<void> {
  const ast = astNodeFor(entityId) as Parameters<typeof setAttributeExpr>[0] | undefined;
  if (!ast) return;
  await applySourceEdits(setAttributeExpr(ast, name, expr));
}

// Unbind a top-level attribute: remove it entirely so the field reverts to
// unset (the author can then type a literal). The code equivalent of the classic
// unbindField op.
export async function unbindAttribute(entityId: number, name: string): Promise<void> {
  const ast = astNodeFor(entityId) as Parameters<typeof removeAttribute>[0] | undefined;
  if (!ast) return;
  await applySourceEdits(removeAttribute(ast, state.source, name));
}

// Write a mixed-content attribute (literal text interleaved with variable
// expressions) as a template literal, e.g. `value={`Score: ${state.score}`}`. An
// all-literal list collapses to a plain string; a single binding to a bare
// expression (see emit-adapter setAttributeSegments).
export async function setMixedContentAttribute(
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
export async function addBindVariable(
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
export async function setStateVariableValue(
  name: string,
  type: string,
  rawDefault: string,
): Promise<void> {
  if (!state.program) return;
  const edits = setStatePropertyValue(state.program as any, name, type, rawDefault);
  if (edits.length) await applySourceEdits(edits);
}

// Add an event-handler callback: seed a top-level `/** @ui-action */ function
// <name>(state: State) {}`. Taking `state` as a PARAMETER (rather than closing
// over the module const) keeps the handler a pure function of state and avoids
// use-before-declaration when it's emitted above the `state` const. It appears in
// the callbacks panel and binds to an event via a thunk
// (`onMouseDown={() => <name>(state)}`). ensureStateScaffold runs first so the
// `State` param type exists.
export async function addBindAction(name: string): Promise<void> {
  await ensureStateScaffold();
  if (!state.program) return;
  const at = afterImports(state.program as any);
  await applySourceEdits([
    { start: at, end: at, text: `\n\n/** @ui-action */\nfunction ${name}(state: State) {}` },
  ]);
}

// Remove an entire callback handler (function + its @ui-action comment).
export async function removeAction(name: string): Promise<void> {
  if (!state.program) return;
  const edits = removeActionDecl(state.program as any, name, lastComments as any, state.source);
  if (edits.length) await applySourceEdits(edits);
}

// Set a handler's whole body from a `{{ var }}` template: resolve each
// placeholder to the variable's expression, then splice the body. props are out
// of scope in a handler, so they're excluded from the resolvable set.
export async function setActionBody(name: string, template: string): Promise<void> {
  if (!state.program) return;
  const code = templateToBody(template, callbackVars(state.bindingSurface.variables));
  const edits = setActionBodyEdit(state.program as any, name, code);
  if (edits.length) await applySourceEdits(edits);
}

// Remove a variable from the typed `state` object (+ its interface member).
export async function removeStateVariable(name: string): Promise<void> {
  if (!state.program) return;
  const edits = removeStateProperty(state.program as any, name);
  if (edits.length) await applySourceEdits(edits);
}

// Change a state variable's type (rewrites the interface member type and resets
// the initializer to the new type's default).
export async function retypeStateVariable(name: string, type: string): Promise<void> {
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
export async function addBindProp(name: string, type: string): Promise<void> {
  const cn = activeComponentName();
  if (!state.program || !cn) return;
  const edits = addPropsProperty(state.program as any, state.source, cn, name, type);
  if (edits.length) await applySourceEdits(edits);
}

// Remove a prop from the active component's props type.
export async function removeProp(name: string): Promise<void> {
  const cn = activeComponentName();
  if (!state.program || !cn) return;
  const edits = removePropsProperty(state.program as any, cn, name);
  if (edits.length) await applySourceEdits(edits);
}

// Change a prop's type.
export async function retypeProp(name: string, type: string): Promise<void> {
  const cn = activeComponentName();
  if (!state.program || !cn) return;
  const edits = setPropsPropertyType(state.program as any, cn, name, type);
  if (edits.length) await applySourceEdits(edits);
}
