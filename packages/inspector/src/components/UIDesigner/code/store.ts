import { useSyncExternalStore } from 'react';

import { getCodeParser } from '../../../lib/logic/code-parser/iframe';
import { getStorage } from '../../../lib/data-layer/client/iframe-data-layer';
import { debounce } from '../../../lib/utils/debounce';
import type { UINodeType } from '../tree-model';
import { type BindingSurface, extractBindingSurface } from './bindings';
import {
  afterImports,
  applyEdits,
  type Edit,
  emitElement,
  insertChild,
  removeNode,
  setAttribute,
  setAttributeExpr,
  setObjectField,
} from './emit-adapter';
import { codeToUINodes } from './parse-adapter';
import type { CodeUINode, ParsedUI } from './types';

// Code-mode store: the .tsx source buffer is the single source of truth; the
// canvas and (later) Monaco are views over it. Parsing is delegated to CH main
// over the CodeParser RPC. Implemented as a tiny external store so Canvas,
// NodeTree, and PropertyPanel all read the same state via useSyncExternalStore.

export interface CodeState {
  filename: string | null;
  source: string;
  parsed: ParsedUI | null;
  // @ui-bind / @ui-action declarations found in the current source.
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

// The scene file backing code-mode. Single-file for the PoC; a ui/ directory +
// ui/index.tsx aggregator (file-per-root) is the documented next step.
export const UI_FILE = 'src/ui.tsx';

// Persist the source to disk through the inspector's storage bridge (debounced,
// so rapid edits coalesce into one write). Only valid parses are persisted, so
// a transient broken-code buffer never reaches the scene's dev build.
async function writeToDisk(path: string, source: string): Promise<void> {
  const storage = getStorage();
  if (!storage) return;
  try {
    await storage.writeFile(path, Buffer.from(source, 'utf8'));
  } catch (e) {
    console.error('[code-mode] failed to persist', path, e);
  }
}
const persistToDisk = debounce(
  (path: string, source: string) => void writeToDisk(path, source),
  400,
);

// Parse `source` (via the RPC bridge) and update the tree. Keeps the previous
// parsed tree on failure so a transient broken-code state doesn't blank the
// canvas — the error is surfaced separately. `persist` (default true) writes the
// source back to disk on a successful parse; the initial file read passes false.
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
    const bindingSurface = extractBindingSurface(program, result.comments as any, source);
    set({
      parsing: false,
      parsed: parsed ?? state.parsed,
      bindingSurface,
      program,
      error: parsed ? null : 'No exported component returning JSX was found',
    });
    if (opts.persist !== false) persistToDisk(filename, source);
  } catch (e) {
    set({ parsing: false, error: e instanceof Error ? e.message : String(e) });
  }
}

// Apply source edits (from a visual op) to the buffer and reparse. Returns the
// new source so callers can also push it into Monaco.
export async function applySourceEdits(edits: Edit[]): Promise<string> {
  const next = applyEdits(state.source, edits);
  await loadAndParse(state.filename ?? UI_FILE, next);
  return next;
}

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

// uiTransform fields that map cleanly to top-level ergonomic props (bare
// numbers, same key). Units, enums (positionType), and nested edges
// (position/margin/padding) need PB→ergonomic translation and are skipped for
// now (a follow-up).
const TRANSFORM_SPLICE_FIELDS = new Set([
  'width',
  'height',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'flexBasis',
  'flexGrow',
  'flexShrink',
]);

// Route a PropertyPanel component patch to source splices. Handles the fields
// that map cleanly to ergonomic react-ecs props; silently skips the rest.
export async function spliceComponentPatch(
  entityId: number,
  componentId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const ast = astNodeFor(entityId) as Parameters<typeof setObjectField>[0] | undefined;
  if (!ast) return;
  const edits: Edit[] = [];

  if (componentId === 'core::UiTransform') {
    for (const [key, value] of Object.entries(patch)) {
      if (TRANSFORM_SPLICE_FIELDS.has(key) && typeof value === 'number') {
        edits.push(...setObjectField(ast, 'uiTransform', key, value));
      }
    }
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
// the source and reparse. The first write-path op wired from the canvas.
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

// Splice a drag-move (absolute reposition) into the source: set the ergonomic
// `position: { top, left }` object on uiTransform.
export async function spliceUiTransformPosition(
  entityId: number,
  top: number,
  left: number,
): Promise<void> {
  const ast = astNodeFor(entityId) as Parameters<typeof setObjectField>[0] | undefined;
  if (!ast) return;
  await applySourceEdits(setObjectField(ast, 'uiTransform', 'position', { top, left }));
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

// Bind a top-level attribute to a variable/handler expression — `value={score}`,
// `onMouseDown={onStart}` — the @ui-bind / @ui-action write path.
export async function bindAttribute(entityId: number, name: string, expr: string): Promise<void> {
  const ast = astNodeFor(entityId) as Parameters<typeof setAttributeExpr>[0] | undefined;
  if (!ast) return;
  await applySourceEdits(setAttributeExpr(ast, name, expr));
}

const VARIABLE_DEFAULT: Record<string, string> = { number: '0', string: "''", boolean: 'false' };

// Insert a new /** @ui-bind */ variable declaration after the imports and
// reparse (the binding surface then includes it). Fixes feedback #15 — a real,
// named, typed variable instead of an auto-named "value".
export async function addBindVariable(name: string, type: string): Promise<void> {
  if (!state.program) return;
  const at = afterImports(state.program as Parameters<typeof afterImports>[0]);
  const value = VARIABLE_DEFAULT[type] ?? "''";
  const text = `\n\n/** @ui-bind */\nlet ${name}: ${type} = ${value}`;
  await applySourceEdits([{ start: at, end: at, text }]);
}

// PoC seed so code-mode renders something immediately. Real file loading
// (open a scene's ui/*.tsx) arrives with M5 / Monaco.
const SAMPLE_SOURCE = `/** @jsx ReactEcs.createElement */
import ReactEcs, { UiEntity, Label } from '@dcl/sdk/react-ecs'

/** @ui-bind */
let score = 0

export function MyScreen() {
  return (
    <UiEntity
      uiTransform={{ width: 640, height: 320, positionType: 'absolute', position: { top: 60, left: 60 } }}
      uiBackground={{ color: { r: 0, g: 0, b: 0, a: 0.6 } }}
    >
      <Label
        value="Hello from code!"
        fontSize={40}
        uiTransform={{ width: 600, height: 80, margin: { top: 24, left: 24 } }}
      />
      <Label
        value="Edit the .tsx and watch this update"
        fontSize={22}
        uiTransform={{ width: 600, height: 40, margin: { left: 24 } }}
      />
    </UiEntity>
  )
}
`;

let bootstrapped = false;

// Bootstrap code-mode: read the scene's real src/ui.tsx and parse it. If the
// file is missing/empty, seed the sample and create it. Runs once.
export function bootstrapFromFile(): void {
  if (bootstrapped || state.source || state.parsing) return;
  bootstrapped = true;
  void (async () => {
    const storage = getStorage();
    let source = '';
    if (storage) {
      try {
        const buf = await storage.readFile(UI_FILE);
        source = buf?.toString('utf8') ?? '';
      } catch {
        // File may not exist yet — fall back to seeding it below.
      }
    }
    if (source.trim()) {
      await loadAndParse(UI_FILE, source, { persist: false });
    } else {
      await loadAndParse(UI_FILE, SAMPLE_SOURCE, { persist: true });
    }
  })();
}
