# UI Designer — code-as-source-of-truth (PoC)

Experimental mode where the scene's real `@dcl/react-ecs` `.tsx` code is the
**single source of truth** for the 2D UI Designer, instead of the ECS composite
/ `asset-packs::UIDesign` derive pipeline. The canvas and an embedded Monaco
editor are two live views over the same source buffer; edits in either splice
back into the code.

Off by default. Enable in the inspector-iframe devtools:

```js
localStorage.setItem('UI_DESIGNER_CODE_MODE', 'true') // then reload
```

Code-mode is **Electron-only**: the parser (`oxc-parser`, native) runs in the
Creator Hub main process and is reached over an RPC bridge (see below).

## Architecture

```
  Canvas (drag/resize/edit) ─┐                        ┌─ Monaco (type code)
                             ▼                        ▼
                        source buffer (store.ts)  ── single source of truth
                             │  parse (debounced, RPC → CH main oxc-parser)
                             ▼
                        UINode tree ── existing Canvas renderer + PropertyPanel
                             │  writes: minimal span splices (never reprint)
                             ▼
                        src/ui.tsx on disk (persisted via storage bridge)
```

- **parse-adapter.ts** — `codeToUINodes(program, source)`: ESTree AST → the
  existing `UINode` tree. `<UiEntity>/<Label>/…` + object-literal props map to
  PB-shaped components (via `ecs-shape.ts`); loops / conditionals / custom
  components / spreads become **opaque nodes** (read-only, verbatim source kept).
- **emit-adapter.ts** — `applyEdits` + `setObjectField` / `setAttribute` /
  `setAttributeExpr` / `insertChild` / `removeNode`: a visual edit → the minimal
  text splice, located by the backing AST node's byte span. Never reprints.
- **ecs-shape.ts** — react-ecs ergonomic props (`positionType:'absolute'`,
  `position:{top}`, unitless numbers) → flattened `PBUiTransform`.
- **bindings.ts** — extracts the `/** @ui-bind */` (state) / `/** @ui-action */`
  (handler) surface from the AST + comments.
- **store.ts** — the source buffer + parsed tree + binding surface as an external
  store (`useSyncExternalStore`); file IO (read/persist `src/ui.tsx`); the write
  helpers used by the canvas / panel.
- **CodeEditorPanel.tsx** — Monaco bound to the store buffer.
- **CodeBindingsSection.tsx** — the code-mode Bindings UI in the PropertyPanel.
- **aggregator.ts** — `generateUiIndex` / `generateRootComponent` for the
  file-per-root layout (`ui/index.tsx` composing `ui/*.tsx`).
- **RPC bridge** — inspector iframe (`lib/logic/code-parser/iframe.ts`) →
  renderer (`creator-hub/renderer/.../rpc/code.ts`) → preload
  (`.../modules/oxc.ts`) → main (`creator-hub/main/.../modules/oxc.ts`,
  native `oxc-parser`).

## What works

- **code → visual**: parse `src/ui.tsx` and render it on the canvas + panel.
- **visual → code** (surgical splices, byte-exact round-trip):
  - Canvas: resize (width/height), drag-move (absolute `position`), palette
    add-child, delete.
  - PropertyPanel: read + write of width/height, background color, Label
    `value`/`fontSize`/`color`.
  - Bindings: bind a field to a `@ui-bind` var (`value={score}`) or `@ui-action`
    handler (`onMouseDown={onStart}`); "+ Add variable" writes a real
    `/** @ui-bind */` declaration.
- **live loop**: type in Monaco → canvas/panel update; edit on canvas/panel →
  Monaco updates. Edits persist to `src/ui.tsx`.

## Deferred (documented, not blockers for the PoC thesis)

- In-flow (flex) reorder splicing; node duplicate; drop-position honoring.
- PropertyPanel enum (`positionType`), unit (`%`/`auto`), and nested-edge
  (position/margin/padding) fields; add/remove-component in code.
- Multi-root **file-per-root** RootsList (roots = files in `ui/`) + rename/delete
  file lifecycle. `aggregator.ts` provides the codegen; the RootsList wiring is
  the next step. The PoC drives a single `src/ui.tsx`.
- Monaco: no TS intellisense (no-op worker); eagerly bundled (~+4.5 MB min —
  needs code-splitting before shipping); canvas→editor sync uses `setValue`
  (resets undo) — could apply the Edit as a Monaco `executeEdits`.
- Standalone inspector (`:8000`) can't parse (no CH main); code-mode is
  Electron-only for now.

## To validate live

1. `cd packages/inspector && npm run start` (rebuilds `public/` in watch mode).
2. Launch Creator Hub; open a scene.
3. In the inspector-iframe devtools: set the flag (above) and reload; temporarily
   un-hide the UI Designer panel.
4. The canvas renders `src/ui.tsx`; edit in Monaco or on the canvas and watch
   both update; run the scene preview to confirm the generated code renders
   natively (it's ordinary react-ecs — no `UIDesign` derive needed).

## Go / no-go

The two riskiest premises are **proven**: OXC gives an AST rich enough for the
mapping, and span-based splicing round-trips the file without disturbing
untouched code/comments/formatting. The bidirectional loop works across three
surfaces (Monaco / canvas / panel) on a real scene file. Recommended next
increments: widen the representable subset (enums/units/nested, reorder), the
multi-root file-per-root RootsList, and Monaco productionization
(workers + code-split).
