---
title: UI Designer — code as the single source of truth
category: feature-implementation
tags:
  [
    inspector,
    ui-designer,
    sdk7-ui,
    react-ecs,
    oxc,
    code-as-source,
    file-per-root,
    variable-bindings,
  ]
components: [store, parse-adapter, emit-adapter, ecs-shape, aggregator, state-convention, bindings]
branch: poc/ui-designer-code-as-source
date: 2026-07-10
status: completed
---

# UI Designer: code as the single source of truth

The UI Designer does not store its own render-only representation of a scene's UI. The scene's real `@dcl/react-ecs` `.tsx` files under `src/ui/` ARE the design — the canvas is a live view over them, spliced in place, and any external editor (VSCode, vim, …) can edit the same files: a 1s disk watcher reflects those edits back onto the canvas. The earlier ECS-composite pipeline (`asset-packs::UI`/`UIBindings`/`UIDesign` + the derive/split/materialize runtime) has been fully removed — code-as-source is the only representation.

## Why code-as-source instead of an ECS mirror

The previous design authored `core::UiTransform`/`UiText`/… as ECS components and derived `asset-packs::UIDesign` from them at save time, then codegenned a `.tsx` from the composite. Two files described one UI, and keeping them in sync was the recurring bug source. Code-as-source collapses that to one file: the canvas parses the `.tsx`, renders a tree from it, and every canvas edit is a source splice, not a component write — there is nothing else to fall out of sync.

## Architecture: parse → tree → splice → reparse

```
disk (.tsx) --parse (OXC/RPC, CH main)--> ESTree program --codeToUINodes--> CodeUINode tree --Canvas/NodeTree render-->
                                                                                    |
                                                                      canvas/panel op (drag, resize, add, bind…)
                                                                                    v
                                                                       emit-adapter Edit[] --applyEdits--> new source
                                                                                    |
                                                                              write to disk
                                                                                    |
                                                                        reparse (loadAndParse) --> tree
```

- **Parsing is CH-main only.** `getCodeParser()` (`packages/inspector/src/components/UIDesigner/code/store.ts:3`) bridges to an OXC parser that runs in the Electron main process over RPC — there is no browser-side parser. This is why `code/store.ts`'s splice/rename flows are _not_ unit-tested (they need the RPC); the pure helpers they call (`parse-adapter`, `emit-adapter`, `state-convention`, `root-naming`, `aggregator`, `bindings`) are, and that split should hold for future work too — put new logic in a pure helper, not directly in a `store.ts` splice function, whenever the logic doesn't need a live parse.
- **`codeToUINodes`** (`code/parse-adapter.ts:138`) walks the parsed `program` and turns each JSX element under the component's `return` into a `CodeUINode`, keyed by a synthetic id assigned in **source order** (`nextId`). Anything it can't represent — a custom component, a spread, a member-expression element name, a non-literal expression child (e.g. a `.map(...)`) — becomes an **opaque node** (`opaqueNode` helper, `:151`) carrying `{ reason, raw }`; it renders read-only.
- **`emit-adapter.ts`** is the write side: pure `Edit[]`-producing functions (`setAttribute`, `setAttributeExpr`, `setObjectField`, `emitElement`, `insertChild`, `removeNode`, `moveElement`, `afterImports`) plus `applyEdits(source, edits)` (`:26`), which is a byte-span splice — it never reparses the whole file into a new AST and re-serializes; it slices the original source text and stitches literal replacement text into the spans it's given. This is what preserves everything the parser can't round-trip losslessly (comments, formatting, unrelated code).
- **`ecs-shape.ts`** converts between the SDK's wire/PB shape (percent-based `UiTransform`, flex enums) and the ergonomic values a human would write in source (`ergonomicToPBTransform` / `pbToErgonomicTransform`, `:58`/`:97`) — the seam that keeps `parse-adapter`/`emit-adapter` from having to know PB encoding.
- Every canvas/panel op in `store.ts` follows the same shape: read the AST node for a synthetic id (`astNodeFor`, `:426`) → build `Edit[]` via `emit-adapter` → `applySourceEdits` → write to disk → `loadAndParse` reparses and republishes the new tree to subscribers (`useSyncExternalStore`-based store, `:1,80-91`).

## File-per-root store

One UI root = one exported component in one file under `src/ui/` (`CodeRoot { name, filename }`, `store.ts:40-45`). A generated `src/ui/index.tsx` aggregator (`aggregator.ts:14` `generateUiIndex`) composes every root into `setupUi()`, and `src/index.ts`'s `main()` is wired (best-effort, `ensureMainWired`, `store.ts:244`) to call it.

Root lifecycle ops (`store.ts:278-362`):

- **`createRoot`** — write `src/ui/<Name>.tsx` (from `generateRootComponent`, which seeds an empty `interface State {}` / `const state: State = {}` so new roots start already conforming to the binding convention), `refreshRoots`, `regenerateAggregator`, `ensureMainWired`, then select it.
- **`removeRoot`** — delete the file, regenerate the aggregator, and reselect the first remaining root (or clear state to the empty root if none remain).
- **`renameRoot`** — **write-new + delete-old**, not a true rename: the storage bridge (`getStorage()`) only exposes read/write/delete, no `rename`. The op re-parses to find the exported identifier's span (`findComponentIdSpan`), splices in the new identifier, writes `src/ui/<NewName>.tsx`, deletes the old file, regenerates the aggregator/wiring, and reselects. Only the declaration identifier's span is touched — a `Label` prop or other string literal containing the old name is left alone. Non-root JSX nodes have no react-ecs "name" to reflect in code, so rename is disabled for them (root-only).

Two guards worth reusing verbatim in similar storage-backed code:

- **`list()`-throws guard** (`refreshRoots`, `store.ts:222-226`): the storage bridge throws if `src/ui/` doesn't exist yet (first run, or a scene that predates code mode) — catch and treat as an empty listing, don't propagate.
- **`writeFile` auto-mkdir** (`writeToDisk`, `store.ts:115-128`): the underlying `StorageRPC.writeFile` `mkdir -p`s the parent directory, so writing a nested path like `src/ui/MainUI.tsx` creates `src/ui/` automatically — no separate `mkdir` call is needed anywhere in the store.

### Reusable pattern: span-match to recover a synthetic id after a splice

`spliceDuplicate` (`store.ts:598-610`) needs to return the _new_ clone's synthetic id to the caller (so it can select it), but the id doesn't exist until after the reparse. Because `codeToUINodes` assigns ids in source order and the clone is inserted at a known offset (`el.end + 1`, just past the inserted `'\n'`), the id is recovered deterministically by scanning `state.parsed.spans` (`Map<number, Span>`) for the entry whose span start equals that offset — no id bookkeeping has to cross the parse/RPC boundary. This pattern generalizes to any op that inserts a node and needs its id back: compute the expected start offset from the edit you're issuing, then span-match after reparse.

## Binding surface: typed `state` (primary) + markers (fallback)

Two conventions feed one merged surface (`buildBindingSurface`, `store.ts:145-160`):

1. **Typed `state` object (primary).** `export interface State { … }` + `export const state: State = { … }` (`state-convention.ts`). A field binds as `value={state.score}`. `findStateNodes` (`:58`) locates both declarations by walking top-level decls (skipped by `codeToUINodes`'s `findComponentReturnJsx`, so seeding them never perturbs the node tree); `readStateVariables` (`:87`) extracts the current `{ name, type, expr }` entries; `addStateProperty` (`:118`) returns the `Edit[]` to insert a new property — into an existing non-empty object (after the last property) or as the first property of an empty `{}` (targets `object.start + 1` / `object.end - 1` to land exactly inside the braces either way).
2. **Hand-authored `@ui-bind`/`@ui-action` JSDoc markers (fallback).** `extractBindingSurface` (`bindings.ts:77`) reads hand-authored/foreign code that doesn't use the typed convention. A field bound this way reads as `value={score}` (bare identifier, no `state.` prefix).

Every binding-surface entry (`BindVariable`, `bindings.ts:23`) carries both a `name` and an `expr` — the exact access expression to splice into the JSX attribute (`state.score` vs `score`). This is what lets `bindAttribute` (`store.ts:614`) and the panel's bindings UI stay convention-agnostic: they splice `expr` verbatim and never branch on which convention produced it. `addBindVariable` (`store.ts:623`) seeds a `state`/`State` pair if none exists yet, so every _new_ variable a user adds through the UI lands in the typed convention — markers only ever originate from hand-written code, never from the editor itself.

## Gotchas surfaced during execution

- **`noUnusedLocals` is off** in the inspector tsconfig (only `strict: true` is set), and `make lint`/`npm run lint` (root-level `eslint . --ext js,cjs,ts`) does not cover `.tsx`. Neither gate flags an unused import — typecheck only catches _dangling_ references (used-but-undeclared), the opposite of what you'd want when deleting a feature flag's dead arms. Removing a conditional branch requires grep-driven dead-code analysis (confirm each candidate symbol's remaining reference count is zero) before deleting the import; typecheck afterward only confirms nothing was left _dangling_, not that everything unused was _found_.
- **Effect dependency arrays hide "still used" reads.** When collapsing a flag's ternary in `Canvas.tsx`, a hook like `useSdk()` read only inside a now-deleted branch can still appear "used" via a `useEffect`/`useDrop` dependency array (e.g. `[sdk, node.entity, dispatch]`) that nothing in the body reads anymore. Trim the dependency array _before_ deleting the variable/import, or the deletion looks unsafe (variable still referenced) when it isn't.
- **Some ECS-shaped fields in a component survive a flag collapse for a reason other than the removed branch** — e.g. `YGU_POINT`/`PBUiTransform`/ `YGPT_ABSOLUTE` in `Canvas.tsx` are used by resize/drag math independent of code vs. classic mode. Don't assume every symbol the spec calls out as a "removal candidate" is actually dead; grep each one's remaining call sites individually.
- **`parser.parse(filename, source)` resolves `{ program, comments }`**, with `program` typed `unknown` over the RPC boundary (it's ESTree-as-plain-JSON). Every caller casts through `Parameters<typeof someAdapterFn>[0]` to recover a usable type rather than exporting `AnyNode` from `parse-adapter.ts` (module-private) — follow that cast-through-the-consumer's-param-type pattern for any new store function that needs the raw program. Const-arrow exports (`export const Hud = () => <.../>`) and function exports (`export function Hud() {…}`) both expose their identifier the same way (`VariableDeclarator.id` vs `decl.id`, both plain `Identifier` nodes with `start`/`end`), so one AST walk (`findComponentReturnJsx`) handles both without a special case.
- **A `Tree<T>` component's `canRename` is the only gate needed for disabling rename** (`../Tree/Tree.tsx`) — no separate context-menu item to suppress. Its `getIcon: (value: T) => JSX.Element` accepts an inline ternary between an opaque warning icon and the existing widget-icon map without a wrapper component, since both sides are already `JSX.Element`, not component references.
- **The pure-helper unit tests obtain a raw ESTree program the same way**: `parseSync('X.tsx', src).program as any` from `oxc-parser` directly (not through the RPC) — used by `aggregator.spec.ts`, `bindings.spec.ts`, `state-convention.spec.ts`, `generated-round-trip.spec.ts`. Only `parse-adapter.spec.ts`'s own `parse()` helper returns the derived `codeToUINodes` tree; don't reuse it when a test needs program-level access (e.g. to feed `findStateNodes`/`findComponentIdSpan` directly).
- **Two verification commands drifted from the actual package scripts.** The spec's Verification section says `cd packages/inspector && npm run lint`, but `packages/inspector/package.json` has no `lint` script — lint is a root-level script (`npm run lint` / `make lint`, `eslint . --ext js,cjs,ts --ignore-path .gitignore`, run from repo root, and it does not cover `.tsx`). Run it unscoped or with `packages/inspector` as an explicit path argument, not via a per-package script that doesn't exist.

## Key files

- `packages/inspector/src/components/UIDesigner/code/store.ts` — the external store (root lifecycle, disk watcher, all splice ops, binding-surface glue).
- `packages/inspector/src/components/UIDesigner/code/parse-adapter.ts` — read side: `codeToUINodes`, opaque-node detection, `findComponentIdSpan`.
- `packages/inspector/src/components/UIDesigner/code/emit-adapter.ts` — write side: span-splice `Edit[]` builders + `applyEdits`.
- `packages/inspector/src/components/UIDesigner/code/ecs-shape.ts` — PB ⇄ ergonomic value conversion (`UiTransform`).
- `packages/inspector/src/components/UIDesigner/code/state-convention.ts` / `bindings.ts` — the two binding conventions feeding `buildBindingSurface`.
- `packages/inspector/src/components/UIDesigner/code/aggregator.ts` — generated `src/ui/index.tsx` + starter-root source templates.
- `packages/inspector/src/components/UIDesigner/code/root-naming.ts` — component-name sanitization + uniqueness.
- `packages/inspector/src/components/UIDesigner/code/CodeRootsList.tsx` — the rail UI over the root list (create/select/rename/remove).

## Known residuals and future work

- PropertyPanel add/remove-component + component-clipboard machinery stays ECS-shaped and is runtime-dead in code mode (synthetic ids never resolve to a real engine entity) — purging it reaches into `FieldRow`/`Container` and is out of scope.
- No in-app editor is mounted (`CodeEditorPanel`/Monaco exists but isn't wired) — editing today is external editor + the 1s disk watcher.
- No browser-only (standalone `:8000`) code mode — the parser is CH-main only.
