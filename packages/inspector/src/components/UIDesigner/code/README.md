# UI Designer — code-as-source-of-truth

The UI Designer's **single source of truth** is the scene's real
`@dcl/react-ecs` `.tsx` code, not the ECS composite / `asset-packs::UIDesign`
derive pipeline. The canvas and the code files on disk are two live views over
the same source: a visual edit on the canvas splices the source, and an
external editor (VSCode/vim) editing the same files is reflected back onto the
canvas by a 1s disk watcher (`store.ts` `pollDisk` / `startWatching`).

This is the only mode — there is no flag or `localStorage` toggle to enable it.

Code-mode is **Electron-only**: the parser (`oxc-parser`, native) runs in the
Creator Hub main process and is reached over an RPC bridge (see below). The
standalone inspector (`:8000`) has no parser and cannot run code-mode.

## File-per-root layout

Each UI is one function component in its own file under `src/ui/`
(`src/ui/<Name>.tsx`, one exported component per file). A generated
`src/ui/index.tsx` imports every root and composes them into `setupUi()`
(`aggregator.ts` — `generateUiIndex` / `generateRootComponent`). New roots start
already conforming: `generateRootComponent` seeds an empty typed `state` object.

## Typed `state` binding surface

A root's bindable values live in a typed `state` object — our recognizable
signature:

```ts
export interface State { score: number }
export const state: State = { score: 0 }
```

A field binds by referencing it (`value={state.score}`). `state-convention.ts`
reads/writes this object (`readStateVariables` / `addStateProperty` /
`findStateNodes`), and the PropertyPanel's "+ Add variable" seeds a `state` /
`State` if none exists, then writes into it. The `/** @ui-bind */` /
`/** @ui-action */` comment markers (`bindings.ts`) remain as the **fallback**
so hand-authored / foreign code still binds (`value={score}`).

## Architecture

```
  Canvas (drag/resize/edit) ──┐                 ┌── external editor (VSCode/vim)
                              ▼                 ▼
                       source files (store.ts) ── single source of truth
                              │  parse (debounced, RPC → CH main oxc-parser)
                              ▼
                       UINode tree ── Canvas renderer + PropertyPanel
                              │  writes: minimal span splices (never reprint)
                              ▼
                       src/ui/*.tsx on disk (persisted via storage bridge;
                       a 1s disk watcher re-reads external edits)
```

- **parse-adapter.ts** — `codeToUINodes(program, source)`: ESTree AST → the
  `UINode` tree. `<UiEntity>/<Label>/…` + object-literal props map to PB-shaped
  components (via `ecs-shape.ts`); loops / conditionals / custom components /
  spreads become **opaque nodes** (read-only, verbatim source kept).
- **emit-adapter.ts** — `applyEdits` + `setObjectField` / `setAttribute` /
  `setAttributeExpr` / `insertChild` / `removeNode`: a visual edit → the minimal
  text splice, located by the backing AST node's byte span. Never reprints.
- **ecs-shape.ts** — react-ecs ergonomic props (`positionType:'absolute'`,
  `position:{top}`, unitless numbers) ↔ flattened `PBUiTransform`.
- **bindings.ts** — extracts the `@ui-bind` / `@ui-action` marker surface from
  the AST + comments (the fallback binding convention).
- **state-convention.ts** — the typed `state` object reader/writer (the primary
  binding surface).
- **root-naming.ts** — unique, valid filename / component-name derivation for
  new and renamed roots.
- **aggregator.ts** — `generateUiIndex` / `generateRootComponent` for the
  file-per-root layout.
- **store.ts** — the external store (`useSyncExternalStore`): source buffer +
  parsed tree + binding surface + roots list; file IO; the disk watcher; the
  root lifecycle (`createRoot` / `selectRootFile` / `renameRoot` / `removeRoot`
  / `refreshRoots` / `regenerateAggregator`) and every `splice*` write helper.
- **CodeRootsList.tsx** — the roots list (roots = files under `src/ui/`):
  create / select / rename / remove.
- **CodeBindingsSection.tsx** — the Bindings UI in the PropertyPanel.
- **RPC bridge** — inspector iframe (`lib/logic/code-parser/iframe.ts`) →
  renderer (`creator-hub/renderer/.../rpc/code.ts`) → preload
  (`.../modules/oxc.ts`) → main (`creator-hub/main/.../modules/oxc.ts`,
  native `oxc-parser`).

## What works

- **code → visual**: parse `src/ui/*.tsx`, render each root on the canvas +
  PropertyPanel; the roots list reflects the files on disk.
- **root lifecycle**: create / rename (renames the file + exported component +
  aggregator import, then reselects) / remove.
- **visual → code** (surgical splices, byte-exact round-trip): canvas add-child,
  resize (width/height), drag-move (absolute `position`, in-flow `margin`),
  reorder / reparent (move the element's source), delete, duplicate.
- **PropertyPanel**: read + write of width/height, background color, Label
  `value` / `fontSize` / `color`; bind a field to a `state` value or a
  `@ui-action` handler.
- **opaque nodes**: code the designer can't represent (loops, conditionals,
  custom components, spreads) renders as a grayed, read-only block on the canvas
  and a warning-icon, rename/add-child-disabled row in the node tree; drops into
  it are rejected. It is edited only in code.
- **bidirectional loop**: edit on the canvas → the source file updates; edit the
  same file in an external editor → the 1s disk watcher reflects it on the
  canvas. The generated code is ordinary react-ecs — the scene preview renders
  it natively (no `UIDesign` derive).

## Not yet

- **In-app editor**: `CodeEditorPanel.tsx` (Monaco, bound to the store buffer)
  exists but is **not mounted** — editing is via an external editor + the disk
  watcher. Re-mounting it needs TS intellisense workers, code-splitting the
  ~4.5 MB bundle, and applying edits via `executeEdits` (to preserve undo).
- **Standalone `:8000`** code-mode (needs a browser-side parser; today the
  parser is CH-main only).
- **Add / remove component** in code from the PropertyPanel (ECS-only today).
- Reorder drop-position honoring on palette add; enum / unit / nested-edge
  property fields.
- Removing the cross-package `asset-packs::UIDesign` runtime derive / split /
  materialize pipeline (a separate, compatibility-sensitive effort).
