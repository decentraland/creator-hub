import { useSyncExternalStore } from 'react';

import { getCodeParser } from '../../../lib/logic/code-parser/iframe';
import { getStorage } from '../../../lib/data-layer/client/iframe-data-layer';
import type { UINodeType } from '../tree-model';
import { generateRootComponent, generateUiIndex } from './aggregator';
import { type BindingSurface, type BindVariable, extractBindingSurface } from './bindings';
import { addStateProperty, findStateNodes, readStateVariables } from './state-convention';
import {
  afterImports,
  applyEdits,
  type Edit,
  emitElement,
  insertChild,
  moveElement,
  removeNode,
  setAttribute,
  setAttributeExpr,
  setObjectField,
} from './emit-adapter';
import { pbToErgonomicTransform } from './ecs-shape';
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
}

export interface CodeState {
  // The active root file the canvas edits (null before any root loads).
  filename: string | null;
  source: string;
  parsed: ParsedUI | null;
  // The roots discovered under src/ui/ (each a component file).
  roots: CodeRoot[];
  // @ui-bind / @ui-action declarations found in the active source.
  bindingSurface: BindingSurface;
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
  bindingSurface: { variables: [], actions: [] },
  program: undefined,
  error: null,
  parsing: false,
};

const listeners = new Set<() => void>();

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

// Merge the two binding conventions into one surface: the typed `state` object
// is primary (`value={state.x}`); hand-authored /** @ui-bind */ markers are the
// fallback for foreign code (`value={x}`). A state var shadows a same-named
// marker var. Actions come only from @ui-action markers (the state convention
// has no action concept).
function buildBindingSurface(program: unknown, comments: unknown, source: string): BindingSurface {
  const markers = extractBindingSurface(program as any, comments as any, source);
  const stateVars: BindVariable[] = readStateVariables(program as any).map(v => ({
    name: v.name,
    type: v.type,
    expr: `state.${v.name}`,
  }));
  const seen = new Set(stateVars.map(v => v.name));
  const variables = [...stateVars, ...markers.variables.filter(v => !seen.has(v.name))];
  return { variables, actions: markers.actions };
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
  set({ filename, source, parsing: true });
  if (!parser) {
    set({ parsing: false, error: 'Code parser unavailable (Creator Hub / Electron only)' });
    return;
  }
  try {
    const result = await parser.parse(filename, source);
    // result.program is the ESTree AST as plain JSON (typed `unknown` over RPC).
    const program = result.program as Parameters<typeof codeToUINodes>[0];
    const parsed = codeToUINodes(program, source);
    const bindingSurface = buildBindingSurface(program, result.comments as any, source);
    set({
      parsing: false,
      parsed: parsed ?? state.parsed,
      bindingSurface,
      program,
      error: parsed ? null : 'This file does not follow the UI Designer convention',
    });
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

const rootsKey = (rs: readonly CodeRoot[]): string => rs.map(r => r.filename).join('|');

// Re-list src/ui/ and update `roots` (only when the set actually changed, so the
// 1s watcher poll doesn't re-render the tree every tick). Excludes the generated
// index.tsx.
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
  const roots = entries
    .filter(e => !e.isDirectory && e.name.endsWith(TSX) && e.name !== 'index.tsx')
    .map(e => ({ name: e.name.slice(0, -TSX.length), filename: `${UI_DIR}/${e.name}` }))
    // Reject files whose basename is not already a valid component identifier:
    // refreshRoots is a trust boundary (a scene may be shared/downloaded), and the
    // name flows verbatim into generated src/ui/index.tsx. toComponentName is the
    // same sanitizer createRoot/renameRoot use; a conforming name is a fixed point.
    .filter(r => toComponentName(r.name) === r.name)
    .sort((a, b) => a.name.localeCompare(b.name));
  if (rootsKey(roots) !== rootsKey(state.roots)) set({ roots });
  return roots;
}

// (Re)generate the src/ui/index.tsx aggregator from the current root set.
async function regenerateAggregator(roots: CodeRoot[]): Promise<void> {
  const src = generateUiIndex(roots.map(r => ({ component: r.name, from: `./${r.name}` })));
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
    // Label text props are top-level JSX attributes, not a nested object.
    for (const key of ['value', 'fontSize', 'color']) {
      if (patch[key] !== undefined) edits.push(...setAttribute(ast, key, patch[key]));
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

// Add a bindable variable to the typed `state` object (seeding an empty
// `state`/`State` scaffold first if the file doesn't have one yet), then
// reparse. The binding surface then includes it as `state.<name>`.
export async function addBindVariable(name: string, type: string): Promise<void> {
  if (!state.program) return;
  // `as any` matches the existing adapter style (cf. store.ts `result.comments as any`).
  let program = state.program as any;
  if (!findStateNodes(program).object) {
    const at = afterImports(program);
    await applySourceEdits([
      { start: at, end: at, text: '\n\nexport interface State {}\nexport const state: State = {}' },
    ]);
    program = state.program as any;
  }
  const edits = addStateProperty(program, name, type);
  if (edits.length) await applySourceEdits(edits);
}
