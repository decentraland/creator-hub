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
import {
  DEFAULT_CANVAS_HEIGHT,
  DEFAULT_CANVAS_WIDTH,
  nodeLabelText,
  type UINodeType,
  type WidgetKind,
} from '../shared/tree-model';
import type { VirtualSize } from './aggregator';
import {
  generateInteractionHelper,
  generatePlatformHelper,
  generateRootComponent,
  generateUiIndex,
  readVirtualSize,
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
  // null when the component's body doesn't reduce to a single JSX root (an empty
  // `return;`, a fragment, or an opaque body). Its props are still read from the
  // signature, so a nested instance can bind them regardless — only the inline
  // canvas preview needs `parsed`.
  parsed: ParsedUI | null;
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
  // The active component exists but returns no JSX (an empty `return`) — a valid
  // EMPTY GUI, not a convention error. Drives the canvas "drop your first
  // element" state. Distinct from `!parsed && error` (a non-conforming file).
  emptyRoot: boolean;
  parsing: boolean;
  // Whether the ACTIVE file has splice history to undo/redo (drives the
  // toolbar buttons; the stacks themselves are module-private).
  canUndo: boolean;
  canRedo: boolean;
  // The design resolution from src/ui/index.tsx's setUiRenderer call — what the
  // explorer scales px against, and therefore what the canvas stage must frame.
  // Lives here and not on the parsed root: it is per-SCENE (one aggregator), not
  // per-root, and parse-adapter only ever sees one root file.
  virtualSize: VirtualSize;
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
  virtualSize: { width: DEFAULT_CANVAS_WIDTH, height: DEFAULT_CANVAS_HEIGHT },
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
const UI_DIR = 'src/ui';
const UI_INDEX = 'src/ui/index.tsx';
// The scaffolded convention helpers. Lowercase basenames by design: they are
// helper modules, not UI roots, and refreshRoots must never list them as GUIs.
const UI_INTERACTION = 'src/ui/interaction.tsx';
const UI_INTERACTION_IMPORT = './interaction';
const UI_PLATFORM = 'src/ui/platform.tsx';
const UI_PLATFORM_IMPORT = './platform';
const UI_HELPERS = new Set([UI_INTERACTION, UI_PLATFORM]);
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
// A code parser without a storage bridge — today the WS data-layer path (a dev
// inspector against a scene server, see redux/data-layer/sagas/connect) — makes code
// mode look live while every read and write is dropped. Name the condition so that
// is diagnosable from the console instead of presenting as edits that never land.
function warnNoStorage(op: string, path: string): void {
  console.warn(`[code-mode] cannot ${op} ${path}: no scene storage on this data layer`);
}

async function writeToDisk(path: string, source: string): Promise<void> {
  const storage = getStorage();
  if (!storage) {
    warnNoStorage('write', path);
    return;
  }
  // Claim the write before it lands: a renderer watching the scene folder for
  // external saves (Bevy's hot reload) must not mistake our own splice for one.
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

// The callback (handler) surface. Handlers receive the args object
// `{ state, props, value }`, so both state variables and props are in scope —
// `{{ counter }}` resolves to `state.counter`, `{{ props.x }}` to `props.x`.
function callbackVars(variables: BindVariable[]): BindVariable[] {
  return variables;
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
    // Props live on the component's function SIGNATURE — read them even when the
    // body doesn't reduce to a single JSX root (empty/opaque body), so a nested
    // instance can still bind its inputs (incl. callbacks). Only the inline
    // preview needs `parsed`.
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

  const selected = getSelectedNodes(reduxStore.getState() as never);
  if (selected.length === 0) return;
  let changed = false;
  const reanchored: Entity[] = [];
  for (const entity of selected) {
    const id = entity as unknown as number;
    if (!pathToNode(prev.root, id)) {
      reanchored.push(entity); // selection wasn't in this tree — leave it alone
      continue;
    }
    const mapped = mapping[id];
    if (mapped === undefined) {
      changed = true; // node vanished — drop it from the selection
      continue;
    }
    if (mapped !== id) changed = true;
    reanchored.push(mapped as unknown as Entity);
  }
  if (changed) reduxStore.dispatch(selectNodes({ nodes: reanchored }));
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
    // Auto-migrate legacy positional @ui-action handlers to the args-object
    // contract ({ state, props, value }). Idempotent — once migrated the handlers
    // are new-form, so the re-parse migrates nothing. Skipped on non-persisting
    // parses (never silently rewrite a file we're only reading).
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
    // Same-file reparse → ids were reassigned in source order; re-anchor every
    // id-keyed consumer (selection, expansion, hidden/locked). A file SWITCH
    // instead resets that state — the previous file's positional ids would
    // collide with the new file's.
    const sameFile = state.filename === filename;
    const prevParsed = state.parsed;
    // A component that EXISTS but returns no JSX is a valid empty GUI (the user
    // adds the first element via the canvas drop zone). Only a file with no
    // recognizable component at all is a convention error.
    const emptyRoot = !parsed && !!activeName && findComponentIdSpan(program, activeName) !== null;
    set({
      filename,
      source,
      parsing: false,
      // For an empty root, drop the tree (don't fall back to the previous file's
      // stale tree); for a transient broken parse, keep the last-good tree.
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
async function formatActiveFile(): Promise<void> {
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
    // Generated helper modules are not roots. (The lowercase basename would also
    // fail the toComponentName fixed-point check below, but be explicit — a
    // helper surfacing as a broken "GUI" in the rail is a confusing failure.)
    if (UI_HELPERS.has(`${UI_DIR}/${e.name}`)) continue;
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

// Adopt the aggregator's design resolution into state, so the canvas frames what
// the scene actually ships. It is hand-editable (generateUiIndex says as much in
// the file it writes), so this is re-read on the disk poll too, not just on the
// regen that carries it forward.
async function syncVirtualSize(): Promise<VirtualSize> {
  const virtual = readVirtualSize(await readFromDisk(UI_INDEX));
  const { width, height } = state.virtualSize;
  if (virtual.width !== width || virtual.height !== height) set({ virtualSize: virtual });
  return virtual;
}

// (Re)generate the src/ui/index.tsx aggregator from the TOP-LEVEL roots only —
// components (marker present) render where they're nested, not standalone.
// The whole file is rewritten, so the one hand-editable value in it (the virtual
// size) is carried over from the previous contents.
async function regenerateAggregator(roots: CodeRoot[]): Promise<void> {
  const top = roots.filter(r => r.topLevel);
  const virtual = await syncVirtualSize();
  const src = generateUiIndex(
    top.map(r => ({ component: r.name, from: `./${r.name}` })),
    virtual,
  );
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
        emptyRoot: false,
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
  const newName = uniqueName(
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

// Duplicate a root: write a copy of its file under a fresh component name (the
// exported identifier respliced the way rename does), regenerate the aggregator,
// and select the copy. Referrers keep pointing at the original.
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
  if (!idSpan) return; // non-conforming file — leave it alone
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
    // 2b. …and an external edit to the aggregator's design resolution, which
    //     regenerateAggregator only picks up when the root SET changes.
    else await syncVirtualSize();
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

// Bootstrap code-mode for the current scene: adopt the src/ui/ directory layout,
// sync the aggregator/wiring and open the first root. A scene with no roots is
// left that way — the canvas's first-run empty state is what tells a new user how
// to start, and seeding one silently would drop them into a GUI they never asked
// for. Then start the disk watcher. Runs once.
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

// ---------------------------------------------------------------------------
// Read helpers (PropertyPanel / canvas node lookup).
// ---------------------------------------------------------------------------

// Look up the backing AST node for a code-mode UINode (by its synthetic id).
function astNodeFor(entityId: number): unknown | undefined {
  return state.parsed?.astNodes.get(entityId);
}

// Every label shown in the active file's tree, so a create/rename can pick one
// that is free ON SCREEN. Deliberately the displayed label rather than just the
// @ui-name: an unnamed node (the root, or hand-authored code) still reads as its
// widget kind, and a new widget of that kind must number past it or the tree
// shows two identical rows. Labels only have to be unique per FILE.
function collectNodeLabels(root: CodeUINode | undefined, exceptId?: number): string[] {
  const out: string[] = [];
  const walk = (n: CodeUINode): void => {
    if ((n.entity as unknown as number) !== exceptId) out.push(nodeLabelText(n));
    n.children.forEach(walk);
  };
  if (root) walk(root);
  return out;
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

// The node a child is laid out BY — what the panel needs to resolve anything
// direction-dependent (the Resize control's Fill borrows flexGrow along the
// parent's main axis, alignSelf across it). A platform variant is a pass-through
// conditional with no layout of its own, so it is skipped: a branch is laid out
// by whatever contains the conditional.
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

// The PB-shaped component value the panel reads for a given SDK component id.
// (uiTransform is already normalized to PB by the parse adapter.)
// The node field an SDK component id reads from. One mapping, used by the element
// value reader and both interaction-layer readers, so a layer resolves exactly
// like the element does.
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

// The PB component value the panel should show while editing `layer`. A non-base
// layer displays its own values OVER base, so a field the layer doesn't override
// still shows what it inherits rather than reading as empty.
export function codeComponentValueForLayer(
  node: CodeUINode | undefined,
  componentId: string,
  layer: InteractionStateKey,
): Record<string, unknown> | null {
  // A non-layerable component (ui::button) reads off the element in EVERY layer —
  // it has no per-state home to merge over.
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

// A layer's OWN values for a component id — no base merge. The panel compares
// against this to tell an overridden field from an inherited one (the displayed
// value is merged, so it can't answer that on its own).
export function interactionLayerValue(
  node: CodeUINode | undefined,
  componentId: string,
  layer: InteractionStateKey,
): Record<string, unknown> | null {
  const field = COMPONENT_FIELD[componentId];
  if (!node?.interaction || !field) return null;
  return (node.interaction.states[layer]?.[field] as Record<string, unknown>) ?? null;
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
  // A platform variant is a conditional EXPRESSION, not an element — it takes no
  // props. Edit the branch for the device you're previewing instead.
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

// Route a PropertyPanel component patch to source splices. Writes are SURGICAL:
// only the ergonomic keys the patch touches are spliced — hand-authored props
// the editor doesn't model survive byte-for-byte.
async function spliceComponentPatchUnlocked(
  entityId: number,
  componentId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const ast = astNodeFor(entityId) as Parameters<typeof setObjectFields>[0] | undefined;
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
    edits.push(...uiTransformPatchEdits(ast, current, patch, boundTransformKeys(node?.bindings)));
  } else if (componentId === 'core::UiBackground') {
    if (!guardElementWrite(entityId, 'spliceComponentPatch')) return;
    // Per-key surgical writes; PB shapes (TextureUnion, numeric enums) convert
    // back to the ergonomic react-ecs form.
    const fields = pbBackgroundPatchToErgoFields(patch);
    if (Object.keys(fields).length) edits.push(...setObjectFields(ast, 'uiBackground', fields));
  } else if (
    componentId === 'core::UiText' ||
    componentId === 'core::UiInput' ||
    componentId === 'core::UiDropdown' ||
    componentId === UI_BUTTON
  ) {
    // Text / Input / Dropdown props — and a Button's own variant/disabled — are
    // top-level JSX attributes, not a nested object. The panel patches the PB
    // numeric enums for textAlign/font (and for variant, the editor-local one);
    // convert them back to the ergonomic strings react-ecs expects before
    // emitting (every other prop is the same shape on both sides).
    const ergo = componentId === UI_BUTTON ? pbToErgonomicButton(patch) : pbToErgonomicText(patch);
    edits.push(...setAttributes(ast, state.source, ergo));
  }

  if (edits.length) await applySourceEdits(edits);
}

// Write ergonomic `uiTransform` fields for a node. For a node WITH interaction
// states the target is its `base` layer, never a JSX attribute: an attribute
// would shadow the layer, splitting one node's styles across two homes (and for
// the pointer props it would replace the helper's own hover/press trackers
// outright). One setObjectFields / setInteractionNested pass per call — separate
// calls against the same stale AST would emit a duplicate attribute when
// uiTransform is absent, or a comma-less pair when it's `{{}}`.
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

// The ergonomic fields that pin a node to the top-left px offset it was dropped
// at. The canvas measures the drop on screen, so whatever pinned the node before
// has to go with it: `dragPinPatch` clears the trailing edges and the centering
// counter-margin an anchor leaves behind. Routed through the panel's surgical
// patch path, so the rest of the object — sizes, padding, props the editor
// doesn't model — is left alone.
function dropPinFields(entityId: number, top: number, left: number): Record<string, unknown> {
  const node = findCodeNode(state.parsed?.root, entityId);
  const current = (node?.uiTransform as Record<string, unknown>) ?? {};
  return uiTransformPatchFields(
    current,
    dragPinPatch(top, left, current),
    boundTransformKeys(node?.bindings),
  );
}

// Move an ABSOLUTE node: splice the ergonomic `position: { top, left }` edges.
// Absolute-only by design — dragging an in-flow node reorders it among its
// siblings instead (see Canvas's reorder drag), so there is no in-flow move that
// writes offsets.
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

/** Move several nodes at once (a multi-selection drag), batched into one reparse. */
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
  const fields: Record<string, unknown> = { width: opts.width, height: opts.height };
  if (opts.position) {
    Object.assign(fields, dropPinFields(entityId, opts.position.top, opts.position.left));
  }
  if (opts.margin) fields.margin = opts.margin;
  await writeUiTransformFields(entityId, 'spliceUiTransformResize', fields);
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
// centred) so picking a file in the panel's Texture field lights it up.
const IMAGE_TEMPLATE =
  "<UiEntity uiTransform={{ width: 200, height: 200 }} uiBackground={{ color: { r: 1, g: 1, b: 1, a: 1 }, textureMode: 'center' }} />";

// The JSX snippet for a widget type (or the image preset), seeded with a free
// @ui-name. Naming happens HERE so every insertion path (add child, tree drop,
// first element, platform-branch seed) gets it without repeating itself; the
// default is the widget kind the user picked, numbered on collision.
function widgetJsx(type: UINodeType, preset?: 'image', named = true): string {
  const jsx =
    preset === 'image' ? IMAGE_TEMPLATE : (CHILD_TEMPLATES[type] ?? CHILD_TEMPLATES.UiEntity);
  if (!named) return jsx;
  const kind: WidgetKind = preset === 'image' ? 'Image' : type === 'UiEntity' ? 'Container' : type;
  return withNodeName(jsx, uniqueName(kind, collectNodeLabels(state.parsed?.root)));
}

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
  const jsx = widgetJsx(type, preset);
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

// Insert a new widget at a precise tree position: `inside` appends it as the
// anchor's last child; `before`/`after` insert it as a sibling of the anchor in
// the anchor's parent. Used by the Nodes-tree drop target (item 6) so a dropped
// widget lands exactly where the insertion line showed, not always appended.
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
    // Anchor IS the parent — append as its last child.
    if (!guardElementWrite(anchorEntityId, 'spliceAddWidget')) return;
    edits = [...insertChild(ast, state.source, jsx)];
  } else {
    // Anchor is a SIBLING — insert relative to it within its parent.
    edits = [...insertSibling(ast, state.source, jsx, dropType)];
  }
  edits.push(...ensureNamedImport(state.program as any, type, '@dcl/sdk/react-ecs'));
  await applySourceEdits(edits);
}

// Place the FIRST element into an EMPTY root: splice `return (<jsx/>)` into the
// active component (which currently returns nothing) and ensure the import. Used
// by the canvas empty-root drop zone / "+ Add element" (item 1). Once this lands
// the reparse yields a real tree and the root is no longer empty.
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
async function canNest(parentRootName: string, childName: string): Promise<boolean> {
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

// Delete a node (or opaque block) by removing its source span. A platform variant
// (or one of its branches) can't just have its span cut — that would leave the
// conditional malformed — so it routes to the unwrap op instead. The RETURNED
// ROOT can't either — that would leave `return ()`, a syntax error the reparse
// silently reverts — so it strips the whole return argument, landing on the
// bare-`return` empty-GUI shape.
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

// Delete several nodes in ONE splice — sequential removals would reassign the
// positional ids mid-batch (removeNodes also drops descendants of removed
// ancestors). The root subsumes everything, so a selection containing it strips
// the whole return. Platform variants/branches need the unwrap op and are only
// handled as a single selection — inside a larger batch they're skipped.
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
  // A platform BRANCH is pinned inside its conditional: moving it out (or
  // inserting a sibling beside it) would leave the conditional missing an
  // operand. The variant node itself moves fine — its span is the whole
  // conditional — but nothing can be nested INSIDE it (it's not an element).
  if (!guardPlatformBranch(entityId, 'spliceMove')) return;
  if (!guardPlatformBranch(anchor.targetId, 'spliceMove')) return;
  // Never move a node INTO a component instance — `<Name />` doesn't render
  // arbitrary children (store-level backstop; the tree also blocks the drop).
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
//
// The copy's @ui-names are renumbered BEFORE the splice: it is inserted whole, so
// its length may change but `cloneStart` does not — and a verbatim copy would
// otherwise duplicate every name in the subtree.
async function spliceDuplicateUnlocked(entityId: number): Promise<number | null> {
  if (!guardPlatformBranch(entityId, 'spliceDuplicate')) return null;
  // Duplicating the returned ROOT in place would leave two siblings inside one
  // `return (...)` — a syntax error the reparse silently reverts. The meaningful
  // duplicate of a root is its GUI: copy the file and select it.
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

// Rename a node: write (or clear) its @ui-name marker. Not guardElementWrite —
// that refuses a node with dynamic props, which is irrelevant to a comment. The
// nodes that genuinely have no name to set are the ones excluded here.
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

// Bind a top-level attribute to a variable/handler expression — `value={score}`,
// `onMouseDown={onStart}` — the @ui-bind / @ui-action write path.
// The interaction layer an attribute write must be redirected into, or null when
// the node has no interaction states (or the prop isn't one the layers own).
// Binding an event handler is the case that MUST be redirected: as a JSX
// attribute it would replace the helper's returned handler and silently kill the
// node's hover/press tracking.
function interactionTargetFor(entityId: number, attrName: string): InteractionAst | null {
  const node = findCodeNode(state.parsed?.root, entityId);
  if (!node?.interaction || !isLayerableProp(node.type, attrName)) return null;
  return interactionAstFor(entityId);
}

/**
 * Which style object a component's props live inside, or null for the components
 * whose props are top-level JSX attributes. `zIndex` and friends are keys of
 * `uiTransform`, not props of the element — react-ecs EntityPropTypes carries only
 * uiTransform/uiBackground/key plus listeners — so binding one as an attribute
 * would emit a prop the renderer ignores and the scene's own tsc rejects.
 */
function styleObjectFor(componentId: string | undefined): 'uiTransform' | 'uiBackground' | null {
  if (componentId === 'core::UiTransform') return 'uiTransform';
  if (componentId === 'core::UiBackground') return 'uiBackground';
  return null;
}

/**
 * Write (or clear, with `undefined`) one key inside a node's style object. Routes
 * to the `base` interaction layer for the same reason writeUiTransformFields does:
 * a JSX attribute would shadow the layer.
 */
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

/**
 * Bind (or unbind, with `expr: undefined`) one flattened uiTransform key. Goes
 * through the panel's own patch path rather than writing the key directly: a
 * nested group (`padding`) is addressed by member, and the re-fold plus the bound
 * overlay is what keeps the group's other members — literal or bound — intact.
 */
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

/**
 * Bind (or unbind) one uiBackground key. A texture member is addressed by a dotted
 * path (`texture.src`), so the whole ergonomic texture object is rebuilt from the
 * node's current PB and the bound member overridden — that keeps the variant's
 * other members (wrapMode / filterMode) and clears the exclusive sibling variant.
 */
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

// Unbind a top-level attribute: remove it entirely so the field reverts to
// unset (the author can then type a literal). The code equivalent of the classic
// unbindField op.
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
  const interaction = interactionTargetFor(entityId, name);
  if (interaction) {
    await applySourceEdits(
      setInteractionFlat(interaction, 'base', { [name]: segmentsFieldValue(segments) }),
    );
    return;
  }
  await applySourceEdits(setAttributeSegments(ast, name, segments));
}

// ---------------------------------------------------------------------------
// Interaction-state styling (hover / press / active). A node's styles move into
// a recognized `useInteraction({ base, hover, … })` call spread onto it — see
// code/interaction-convention.ts for why a recognized helper beats an inline
// ternary (which would mark the node dynamicProps and freeze ALL panel edits).
// ---------------------------------------------------------------------------

// Write the scene-local helper module. Idempotent, and it never overwrites: an
// author who tuned the merge/chaining keeps their version.
async function ensureInteractionHelper(): Promise<void> {
  if (await readFromDisk(UI_INTERACTION)) return;
  await writeToDisk(UI_INTERACTION, generateInteractionHelper());
}

// The interaction call backing a node, or null when it has none.
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

// A collision-free local name for the interaction const. Scans the whole source
// rather than just declarations — conservative, cheap, and it guarantees the
// generated name can't shadow something the author references.
function uniqueLocalName(base: string, source: string): string {
  const safe = isValidIdentifier(base) ? base : 'interactionStyles';
  let name = safe;
  for (let i = 1; new RegExp(`\\b${name}\\b`).test(source); i++) name = `${safe}${i}`;
  return name;
}

// Convert a plain element into an interactive one. The edit composition itself is
// pure (interaction-convention.wrapInInteractionEdits); this op owns only the IO:
// scaffolding the helper file, normalizing a concise-body arrow, and naming.
async function addInteractionStatesUnlocked(entityId: number): Promise<void> {
  const node = findCodeNode(state.parsed?.root, entityId);
  if (!node || node.interaction) return;
  if (!guardElementWrite(entityId, 'addInteractionStates')) return;
  if (!state.program) return;

  await ensureInteractionHelper();

  // A concise-body arrow (`() => <jsx/>`) has no block to hold the const —
  // convert it first, then work against the reparsed spans.
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

// Unwrap back to a plain element (see interaction-convention.unwrapInteractionEdits).
async function removeInteractionStatesUnlocked(entityId: number): Promise<void> {
  const ast = interactionAstFor(entityId);
  const el = astNodeFor(entityId) as Parameters<typeof unwrapInteractionEdits>[1] | undefined;
  if (!ast || !el) return;
  const edits = unwrapInteractionEdits(ast, el, state.source);
  if (edits.length) await applySourceEdits(edits);
}

// Route a PropertyPanel patch into ONE interaction layer instead of the element's
// own attributes — the same conversions spliceComponentPatch uses, which is the
// point: the panel reuses its existing field editors for every state.
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
    // Re-fold groups against THIS layer's own values, not the merged result — an
    // override must not silently absorb the base layer's other edges.
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

// Add / drop a whole layer (the panel's per-state add and reset).
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

// Bind (or clear) the boolean expression driving the `active` layer — how a
// persistent selected/toggled style is wired, via the existing variable picker.
async function setInteractionActiveBindingUnlocked(
  entityId: number,
  expr: string | undefined,
): Promise<void> {
  const ast = interactionAstFor(entityId);
  if (!ast) return;
  const edits = setInteractionActive(ast, expr);
  if (edits.length) await applySourceEdits(edits);
}

// ---------------------------------------------------------------------------
// Platform (device) variants: a node gets two structurally different subtrees,
// selected by `platform === 'mobile' ? … : …` — see code/platform-convention.ts
// for why the construct is recognized rather than left opaque.
// ---------------------------------------------------------------------------

// Write the scene-local helper module. Idempotent, and it never overwrites — an
// author who changed the platform mapping keeps their version.
async function ensurePlatformHelper(): Promise<void> {
  if (await readFromDisk(UI_PLATFORM)) return;
  await writeToDisk(UI_PLATFORM, generatePlatformHelper());
}

// The device the canvas previews, which is also the branch edits land in.
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

// The platform conditional backing a variant node, or null when it isn't one.
function platformAstFor(entityId: number): PlatformVariantAst | null {
  const node = astNodeFor(entityId) as Parameters<typeof parsePlatformConditional>[0] | undefined;
  if (!node) return null;
  return parsePlatformConditional(node, platformStatements());
}

// The variant a node belongs to: the node itself when it IS the variant, else the
// variant whose branch it is (`branch` set in that case).
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

// Refuse a structural op (move / duplicate) on a variant BRANCH: its element is an
// operand of the conditional, so removing it or inserting a sibling beside it
// leaves the conditional malformed.
function guardPlatformBranch(entityId: number, opName: string): boolean {
  if (!findCodeNode(state.parsed?.root, entityId)?.platform) return true;
  console.warn(`[code-mode] ${opName}: a platform branch can't be moved out of its variant`);
  return false;
}

// Give a node two device variants: it becomes the DESKTOP branch and an empty
// container seeds the mobile one. The edit composition is pure
// (platform-convention.wrapInPlatformEdits); this op owns only the IO —
// scaffolding the helper file, normalizing a concise-body arrow, and naming.
async function addPlatformVariantUnlocked(entityId: number): Promise<void> {
  const node = findCodeNode(state.parsed?.root, entityId);
  // Variants don't nest: a branch already belongs to one, and the variant node
  // itself is the conditional.
  if (!node || node.platform || node.platformVariant) return;
  if (!state.program) return;

  await ensurePlatformHelper();

  // A concise-body arrow (`() => <jsx/>`) has no block to hold the const —
  // convert it first, then work against the reparsed spans.
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
      // A `return` argument takes the bare conditional; a JSX child needs the
      // `{…}` expression container around it.
      braced: entityId !== (state.parsed?.root.entity as unknown as number),
    }),
    ...ensureNamedImport(state.program as any, 'UiEntity', '@dcl/sdk/react-ecs'),
  ]);
}

// Fill in the branch a hand-authored one-sided conditional left as `null`
// (`platform === 'mobile' ? <A /> : null`).
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

// Collapse a variant back to a single node. Given a BRANCH, the OTHER branch
// survives (that is what "remove this device's variant" means); given the variant
// itself, the branch for the device being previewed survives.
async function removePlatformVariantUnlocked(entityId: number): Promise<void> {
  const found = platformVariantOf(entityId);
  if (!found) return;
  const ast = platformAstFor(found.variant.entity as unknown as number);
  if (!ast) return;
  const wanted: DeviceKind = found.branch
    ? found.branch.platform === 'mobile'
      ? 'desktop'
      : 'mobile'
    : activePlatform();
  // Fall back to whichever branch actually exists, so removing the variant of a
  // one-sided conditional isn't a silent no-op.
  const keep = branchElement(ast[wanted])
    ? wanted
    : branchElement(ast.desktop)
      ? 'desktop'
      : 'mobile';
  const edits = unwrapPlatformEdits(ast, keep, state.source);
  if (edits.length) await applySourceEdits(edits);
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

// Ensure the `UiAction` args-object scaffold exists: a `props: {}` param on the
// component (so `Parameters<typeof C>[0]` is valid) + the `type UiAction = { state;
// props; value? }` alias. Seeded before the first callback. State must exist first
// (UiAction references it) — callers run ensureStateScaffold beforehand.
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

// Add an event-handler callback: seed a top-level `/** @ui-action */ function
// <name>({ state, props, value }: UiAction) {}`. The args OBJECT lets a handler
// read/mutate `state`, read/call `props` (e.g. invoke a callback the parent
// passed, after any pre-logic), and receive the event `value` — all order-free
// and extensible. `value` is typed `unknown` (its value-linking design is
// deferred). ensureStateScaffold + ensureUiActionScaffold run first so `State`
// and `UiAction` exist.
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
