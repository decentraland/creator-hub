---
title: UI Designer UIDesign Derive Pipeline
category: feature-implementation
tags:
  [
    inspector,
    ui-designer,
    sdk7-ui,
    asset-packs,
    uidesign,
    tween-pattern,
    variable-bindings,
    ui-runtime,
  ]
components:
  [
    UIDesign,
    ui-runtime,
    engine-to-composite,
    ui-design-migration,
    PropertyPanel,
    setUiContext,
    setUiCallback,
  ]
branch: worktree-feat-ui-designer
date: 2026-06-18
status: completed
---

# UI Designer: the UIDesign derive pipeline

The UI Designer stores each UI node's render data as a single, pristine `asset-packs::UIDesign` component and re-derives the live `core::Ui*` render components from it on every tick. This doc explains why that indirection exists, how the pieces fit together, what it costs to maintain, and how scene code links runtime variables and callbacks into a designed UI.

The runtime lives in `packages/asset-packs/src/ui-runtime.ts`. For the inspector-side editor patterns (field configs, pickers, canvas, and codegen), see [UI Designer Improvements](./ui-designer-improvements.md).

## Why derive instead of persisting `core::Ui*` directly

The obvious design is to author and persist `core::UiTransform`, `core::UiText`, and friends directly. The UI Designer doesn't, for two concrete reasons.

- **Scale compounding.** The editor scales the UI to fit the design canvas, and the runtime scales it again to fit the player's screen. If you persist the _scaled_ `core::UiTransform` and re-scale it on the next load, the scale factor multiplies on every save/load round-trip and the layout drifts. Storing the **unscaled** design once and deriving the scaled output fresh each tick is idempotent — it never compounds.
- **Variable bindings.** Binding resolution runs _inside_ the derive step (`resolveBoundValue` / `resolveBoundCallback` in `ui-runtime.ts`). A field whose value comes from a scene variable (for example, a bound background color or label text) only works because the runtime recomputes that field every tick. A statically persisted component can't express a binding.

<!-- prettier-ignore -->
> [!NOTE]
> This is the SDK's own `Tween` idiom: `Tween` is the input that describes the
> motion, and `Transform` is the derived output the renderer reads. `UIDesign`
> is the input; `core::Ui*` is the derived output. The two representations
> mirror each other on purpose — that duplication is the price of idempotent,
> non-compounding derivation, not accidental cruft.

## How the pipeline works

`UIDesign` is the source of truth. The live `core::Ui*` components are derived output that the runtime owns and rewrites. The design crosses three boundaries:

1. **Save (encode)** — `dumpEngineToComposite` (`packages/inspector/src/lib/data-layer/host/utils/engine-to-composite.ts`) folds each UI node's `core::Ui*` render components into one `UIDesign` value and suppresses the verbatim `core::Ui*` (gated by `UI_RENDER_COMPONENT_NAMES`). Spatial fields stay unscaled.
2. **Editor load (split)** — `splitUIDesignToCore` (`packages/inspector/src/lib/data-layer/host/utils/ui-design-migration.ts`) reverses the fold so the inspector edits live `core::Ui*` components, then drops `UIDesign`.
3. **Runtime tick (materialize)** — `createUIRuntimeSystem` (`packages/asset-packs/src/ui-runtime.ts`) reads `UIDesign`, resolves bindings, applies the screen scale, and writes the scaled `core::Ui*` back via the `materialize*` helpers. `writeIfChanged` keeps this from churning the CRDT when nothing changed.

Because the input (`UIDesign`) and output (`core::Ui*`) are distinct components, re-running the system over a persisted scene re-derives the output from the pristine input every time — the scale never accumulates.

## Adding a new render component

Any `core::Ui*` render component must flow through all three boundaries. A component left out of the pipeline is never re-derived and silently drops on hot-reload — this is exactly what happened to `core::UiBackground` before it was folded in. To add one, touch these five sites:

| # | Site | File |
| --- | --- | --- |
| 1 | Add the JSON-encoded field to the `UIDesign` schema | `packages/asset-packs/src/versioning/registry.ts` |
| 2 | Add the component id to `UI_RENDER_COMPONENT_NAMES` | `packages/inspector/.../engine-to-composite.ts` |
| 3 | Serialize it into the `UIDesign` value (encode loop) | `packages/inspector/.../engine-to-composite.ts` |
| 4 | Restore it in `splitUIDesignToCore` | `packages/inspector/.../ui-design-migration.ts` |
| 5 | Add a `materialize*` and call it in `materializeSubtree` | `packages/asset-packs/src/ui-runtime.ts` |

Scale only the spatial fields. `core::UiBackground`, for example, has no spatial fields, so `materializeBackground` passes `texture`, `textureMode`, and `uvs` through unchanged and only resolves the bound `color`.

## Maintainability tradeoffs

The five-site change is a real tax, but a bounded one.

- The render-component set is small and stable — `UiTransform`/`UiText`/`UiInput`/`UiDropdown`/`UiBackground` covers essentially all of SDK7 UI — so you pay the tax rarely.
- The five sites are documented here and as an invariant in the repo `CLAUDE.md`, so the checklist is explicit rather than tribal.
- **Future option:** if the set grows, collapse the five edits into one table-driven descriptor per component (for example, `{ id, scalableFields, bindableFields }`) that the encode, split, and materialize steps iterate. With only five components today, the explicit form is arguably clearer than that abstraction; revisit it when a sixth lands.

## Linking variables from scene code

A designed UI exposes two kinds of slots, both declared in the Variables panel and emitted into the auto-generated `ui-contexts.ts`:

- **Context values** (text, numbers, colors) — drive bound fields. Set them with `setUiContext`.
- **Callbacks** — wired to events such as a button's `onMouseDown`. Register them with `setUiCallback`.

The generated interfaces tell you which is which. For a UI root named `Main`:

```ts
// assets/scene/ui-contexts.ts (auto-generated — do not edit)
export interface MainContext {
  Score: number;
}
export interface MainCallbacks {
  OnClickButton: () => void;
}
```

Anything under `*Context` uses `setUiContext`; anything under `*Callbacks` uses `setUiCallback`. Both functions take the UI **root entity**, which you resolve by name through the generated `UiEntityNames` enum.

<!-- prettier-ignore -->
> [!IMPORTANT]
> A callback registered with `setUiContext` silently never fires — the click
> path reads the callback registry, not the value registry. Match the function
> to the generated interface.

### Context values: write on change, not every tick

`setUiContext` stores a value that the runtime reads every tick. You only write when the value changes — you don't need a per-frame system to keep pushing it.

```ts
import { engine } from '@dcl/sdk/ecs';
import { setUiContext } from '@dcl/asset-packs';
import { UiEntityNames } from '../assets/scene/ui-entity-names';

export function main() {
  const uiMain = engine.getEntityByName(UiEntityNames.Main);

  let score = 0;
  setUiContext(uiMain, { Score: score }); // initial value

  function addPoint() {
    score++;
    setUiContext(uiMain, { Score: score }); // push only when it changes
  }
}
```

A per-tick `engine.addSystem(() => setUiContext(...))` works but is wasteful — it re-pushes an unchanged value every frame. Reserve a system for values that genuinely change every frame, such as a countdown timer.

### Callbacks: register the function

`setUiCallback` registers a function for a `*Callbacks` slot. Callbacks resolve at fire time, so you can register or replace them at any point after setup.

```ts
import { engine } from '@dcl/sdk/ecs';
import { setUiCallback } from '@dcl/asset-packs';
import { UiEntityNames } from '../assets/scene/ui-entity-names';

export function main() {
  const uiMain = engine.getEntityByName(UiEntityNames.Main);

  setUiCallback(uiMain, 'OnClickButton', () => {
    console.log('Button clicked');
  });
}
```

Use `engine.getEntityOrNullByName(UiEntityNames.Main)` instead if you need to guard against the root not existing yet. To stop driving a UI, call `clearUiContext(uiRoot)` (values fall back to declared defaults) or `clearUiCallback(uiRoot, name)` (for example, on unmount, to drop a stale closure).

## Key files

- `packages/asset-packs/src/ui-runtime.ts` — the runtime system, `decodeDesign`, the `materialize*` helpers, and binding resolution.
- `packages/asset-packs/src/ui-context.ts` — `setUiContext`, `setUiCallback`, and their clear/read counterparts.
- `packages/asset-packs/src/versioning/registry.ts` — the `UIDesign` schema.
- `packages/inspector/src/lib/data-layer/host/utils/engine-to-composite.ts` — the encode boundary and `UI_RENDER_COMPONENT_NAMES`.
- `packages/inspector/src/lib/data-layer/host/utils/ui-design-migration.ts` — the editor-load split.

## Known residuals and future work

- **Duplicate naming.** `duplicateUINode` names clones `"<name> copy"` and copies descendant names verbatim, so a duplicated subtree can still collide; only the drag-drop (`addUINode`) and root (`createUIRoot`) paths use `generateUniqueUiName` today.
- **Table-driven render components.** See the maintainability option above.
- **Context/callback guard.** `setUiContext` and `setUiCallback` fail silently when misused; a dev-mode warning would surface the mistake earlier.
