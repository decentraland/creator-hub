---
title: UI Designer Improvements Feature Implementation
category: feature-implementation
tags:
  [
    inspector,
    ui-designer,
    sdk7-ui,
    field-configs,
    variable-bindings,
    color-picker,
    texture,
    asset-packs,
    react-colorful,
  ]
components:
  [
    PropertyPanel,
    Canvas,
    FieldConfig,
    RgbaColorField,
    TextureField,
    useFieldBinding,
    VariablesPanel,
    variable-codecs,
    ui-runtime,
    ui-context,
  ]
branch: worktree-feat-ui-designer
date: 2026-06-05
status: completed
---

# UI Designer Improvements

A broad sweep over the Inspector's SDK7 UI Designer: a 9-phase spec plus two auto-fix iterations, a deferred-items follow-up, a texture union picker, and a canvas preview. Delivered together: full `PBUiTransform`/`UiText`/`UiInput`/`UiDropdown` **property coverage**, **canvas fidelity** (border/radius/zIndex + per-type Input/Dropdown/Button visuals), **conditional fields** (margin disabled under Absolute), **px↔% conversion** against the parent's measured box, an **RGBA color picker** on `react-colorful`, per-property **tooltips**, **variable-default editors** (boolean toggle + color swatch), clearer **callback field UX**, per-sub-field **scalar bindings** to NUMBER variables, a **shared variable codec** in `@dcl/asset-packs` (single source for inspector editors + runtime renderer), and a 3-variant **texture union picker** (File/Avatar/Video) with a file-variant **canvas DOM preview**.

The raw per-phase findings live under `docs/specs/ui-designer-*/learnings/` — the `improvements`, `engine-native-runtime`, `uidesign-component`, `mixed-content`, `node-ops-events-codegen`, and `texture-boundaries` spec families, each with its fix iterations — alongside the review reports. This doc is the distilled, durable layer across all of them.

The runtime is engine-native: `packages/asset-packs/src/ui-runtime.ts` (`createUIRuntimeSystem`) derives the live `core::Ui*` render components from a pristine `asset-packs::UIDesign` source each tick. See [the UIDesign derive pipeline](./ui-designer-uidesign-pipeline.md) for that architecture and the scene-code variable-linking API.

---

## Key Patterns & Conventions Established

### `FieldConfig.writeAll` — one control fans out to all corners/sides

A `writeAll?: string[]` member on `FieldConfig` lets a single editor write its value to _every_ listed PB path (and the matching `${path}Unit` for `length`). Reads come from `path`. This is how "one Corner radius → all 4 corners", Border width → all 4 sides, and Border color → all 4 colors work, mirroring the existing padding/margin quad pattern.

**Why:** matches the common authoring intent (set one radius) while keeping per-corner control reachable, without a bespoke editor per group. **File:** `packages/inspector/src/components/UIDesigner/field-configs.ts:63-68` (the member); `expandWriteAll(...)` in `packages/inspector/src/components/UIDesigner/PropertyPanel.tsx:83` (the fan-out). **Reuse:** any "single control → N sibling PB keys" group.

### `FieldConfig.disabledWhen(componentValue)` — conditional field disable

A pure predicate `(componentValue) => boolean` on `FieldConfig`. When it returns true the editor renders greyed/`disabled`. Reads the same `componentValue` the `FieldRow` already holds — no Redux plumbing. Used to disable margin when `positionType === Absolute` (Yoga ignores it).

**Why:** least-invasive hook for conditional state; a predicate over already-available data beats a new prop chain. **File:** `field-configs.ts:69-74` (the member); evaluated at `PropertyPanel.tsx:251`. **Reuse:** any field whose validity depends on a sibling value. Note the implemented disable greys only the input controls, not the `Block` label (a full label+control grey would need a `disabled` prop threaded through `BindableField` → `Block`).

### `FieldConfig.info` + `Block` `info` prop → `InfoTooltip`

Per-property help text. `FieldConfig.info` is a `string`; `Block` gained an `info?: React.ReactNode` prop that renders the existing `InfoTooltip` (wraps decentraland-ui `Popup`) as a help-icon trigger beside the label.

**Why:** reuses an existing tooltip component; only the `Block` wiring + the help strings are new. **File:** `packages/inspector/src/components/Block/Block.tsx:17-25` (`.Block-label-row` span + `InfoTooltip`); `InfoTooltip` imported from the subdir barrel `../ui/InfoTooltip` (named export only). **Reuse:** any `Block`-wrapped field can take `info=…`.

### `useFieldBinding(field, entity)` — shared bind/unbind + picker state

A hook holding `pickerOpen`/`anchorRef`/`onBind`/`onUnbind` and the `${componentId}.${path}` path key. Consolidated `BindableField` and `BindableSubField`, which were near-verbatim copies (a fixes-1 finding).

**Why:** binding-affordance changes now touch one place; removed a duplicated component's worth of logic and a duplicated CSS hover rule. **File:** `packages/inspector/src/components/UIDesigner/useFieldBinding.ts`. **Reuse:** any new bindable affordance variant — wrap the hook, vary only the surrounding markup (Block vs. bare row).

### Per-sub-field scalar binding to NUMBER variables (no Vec2/Vec4)

Layout/number scalars (`width`, each `positionTop`, `opacity`, `fontSize`, `selectedIndex`, …) bind individually to a NUMBER variable via per-sub-field bind affordances. The runtime resolves them through a generic "resolve bound `core::UiTransform` fields" pass — no new variable type, no codegen/`parseDefault` change.

**Why:** per-`field.path` scalar binding fully delivers "bind width / bind position" and fits the existing model. Vec2/Vec4 would only add atomic _pair_ binding (one var → whole Size — not the ask) at the cost of touching `variable-enums`, codegen, runtime, and UI. Deliberately scoped out. **File:** picker mapping in `VariablePicker` (`KIND_TO_VARIABLE_TYPES`); the runtime resolves bound `core::UiTransform` fields in `materializeTransform` (`packages/asset-packs/src/ui-runtime.ts`). The pass reads the per-entity bindings map once per node per tick and writes the live component only when a value actually changed (`writeIfChanged`) — negligible cost.

### `RgbaColorField` on `react-colorful` — Color4 ↔ RGBA, portal popover

A swatch button that opens a `react-colorful` `RgbaColorPicker` in a `createPortal` popover. Replaces the old native `<input type=color>` + range slider (RGB-only, no alpha). Color4 channels are 0..1; react-colorful RGBA is r/g/b 0..255, a 0..1 — conversion in `color.ts`.

**Why:** the native inputs couldn't carry the UIDesigner's Color4 alpha; `react-colorful` (~2.8 kb) was user-requested. Same component reused for color **variable defaults** in `VariablesPanel`. **File:** `packages/inspector/src/components/ui/RgbaColorField/RgbaColorField.tsx`; conversions in `packages/inspector/src/components/ui/RgbaColorField/color.ts` (`color4ToRgba`/`rgbaToColor4`/`color4ToHex`; `hexToColor4` delegates to the shared `parseHexColor`). **Reuse:** any Color4 editor. Imported from the subdir (`../ui/RgbaColorField`), not the top-level `../ui` barrel.

### px↔% conversion via `measure.ts` + the `node-registry` entity→element Map

On a length unit switch, `convertLength` recomputes the value against the parent's rendered logical px box. The parent box is found by `measureParentBox(entity)` → `getNodeElement(entity)` (a `Map<number, HTMLElement>`) → `.parentElement.getBoundingClientRect() / CANVAS_SCALE`. `axisForPath` picks width vs. height (`/height|top|bottom/i`).

**Why:** the DOM box is already measured for the canvas; no Redux plumbing. The `Map` (`node-registry.ts`) **replaced** the prior `document.querySelector('[data-entity="…"]')` lookup — removing the string-interpolated selector sink entirely (a tracked security pattern), not just hardening it. Guard: unmeasurable parent → `dim=0` → value unchanged (just swaps the unit). **File:** `packages/inspector/src/components/UIDesigner/measure.ts` (+ `node-registry.ts`); canvas registers/unregisters each node element in `Canvas.tsx:389-391`. **Reuse:** any code needing a node's live DOM box — call `getNodeElement(entity)`, never build a `[data-entity]` selector.

### Shared variable codec in `@dcl/asset-packs` (`variable-codecs.ts`)

A single validated codec per `VariableType`, exported from asset-packs and imported by **both** the inspector editors and the runtime renderer: `parseVariableDefault` (string → runtime value), `validateVariableDefault` (editor-side, returns error message or null), `parseHexColor` (strict `#RRGGBB`/`#RRGGBBAA` → Color4-shaped, NaN-safe), and `validateAssetPath` (defense-in-depth path check). It is a **pure module** — strings/numbers/plain objects only.

**Why:** color/number/default validation previously diverged between two parsers in two packages (inspector vs. runtime). One codec means the editor rejects exactly what the runtime can't parse. The old `parseDefault` wrapper was inlined — the runtime now calls `parseVariableDefault` directly. **File:** `packages/asset-packs/src/variable-codecs.ts`; consumed by the runtime `packages/asset-packs/src/ui-runtime.ts` (`resolveBoundValue` / `resolveMixedField`), `VariablesPanel.tsx`, `RgbaColorField/color.ts`, and `TextureField.tsx`. **Reuse / contract notes:** STRING and STRING_ARRAY defaults are **free text** (always valid — no `..` guard; path rules belong on asset fields, not free-text vars). `validateAssetPath` is the single source of the `'Invalid asset path'` message; it is a labelled **operator-trust defense-in-depth** denylist (`..`, `\`, `%2e`/`%2E`, leading `/`) — not a trust-boundary validator. If ever reused to gate a real fs/HTTP fetch, decode + normalise before checking.

### `TextureField` — 3-variant union picker + canvas DOM preview

`TextureField` owns the `PBUiBackground.texture` `TextureUnion`: a Type dropdown (File / Avatar / Video) plus the per-variant editor, each writing the discriminated `{ tex: { $case, … } }` shape. The canvas previews the **file** variant only, resolving `texture.src` to a blob URL via `useAssetUrl` and layering it as a CSS `background-image`.

**Why:** the union needed a dedicated picker, validation, and per-variant inputs; consolidating it in one component keeps `PropertyPanel`'s `texture` case to a thin `<TextureField value onChange>`. `useAssetUrl` was generalized from the Scene Info panel to also serve the canvas loader. **File:** `packages/inspector/src/components/UIDesigner/TextureField/TextureField.tsx`; preview wiring in `Canvas.tsx` (`texSrc` read at :327, `useAssetUrl` at :328, `textureStyle` at :289, applied at :676); `packages/inspector/src/hooks/useAssetUrl.ts`. **Reuse:** the `$case` write shape and the `validateAssetPath`-on-commit pattern for any other `TextureUnion`/asset-path field.

### Engine-native runtime — `core::Ui*` derived from `asset-packs::UIDesign`

The runtime is a plain ECS system (`createUIRuntimeSystem`). Each tick it reads the pristine `asset-packs::UIDesign` per node, resolves bindings, applies the screen scale, and writes the live `core::UiTransform`/`UiText`/`UiInput`/`UiDropdown`/`UiBackground` through `materialize*` helpers guarded by `writeIfChanged`.

**Why:** persisting _scaled_ render components compounds the scale on every save/load; deriving from an unscaled source is idempotent. Binding resolution lives in the derive step, so a statically persisted component couldn't carry variable bindings. **File:** `packages/asset-packs/src/ui-runtime.ts`; scene-code API in `packages/asset-packs/src/ui-context.ts`. **See:** [UIDesign derive pipeline](./ui-designer-uidesign-pipeline.md) for the encode/split/materialize boundaries and the five touch points to add a render component.

### Mixed-content fields — literal + variable segments in one field

A text field can interleave literal text and variable references (for example, `"Score: {score}"`). Segments live on `asset-packs::UIBindings` as a `segments` array (`kind: 'literal' | 'binding'`): a row with a non-empty `segments` is mixed-content, a row with only `variable` is a single binding. The runtime concatenates a field's segments in `resolveTextField`, coercing non-string values to string.

**Why:** one field mixes static and dynamic text without a bespoke component. **File:** editor in `packages/inspector/src/components/UIDesigner/MixedContentField/`; segment writes via `set-mixed-content.ts` and the `ui-bindings-store.ts` read/write helpers; runtime resolution in `ui-runtime.ts`. **Gotcha:** `getOrNull` returns `DeepReadonly<T>`; cast to mutable (`as UIBindings['value']`) only at the `createOrReplace` boundary in `ui-bindings-store.ts`, never inline.

### Dedicated `*-ui-*` node operations walk the UiTransform parent index

UI nodes carry only `core::UiTransform` and are absent from the editor `Nodes` tree, so generic entity ops (`duplicateEntity`, `removeEntity`) no-op or corrupt the subtree. Every UI-node lifecycle op has a dedicated implementation that walks `collectDescendants` (inclusive DFS over `core::UiTransform.parent`): `add-ui-node`, `remove-ui-node`, `duplicate-ui-node`, `set-ui-parent`, `reorder-ui-sibling`, `repair-ui-root`.

**Why:** the UiTransform parent index — not the `Nodes` tree — is the UI subtree's source of structure. **File:** `packages/inspector/src/lib/sdk/operations/tree-walk.ts` (`collectDescendants`); the `*-ui-*` ops alongside it. **Reuse:** any new UI subtree traversal — walk `collectDescendants`, never the `Nodes` tree or `core::Transform`.

### Codegen emits three name/context files; author strings are escaped

On save, the host generates `entity-names.ts` (all scene entities), `ui-entity-names.ts` (UI entities only), and `ui-contexts.ts` (per-root `*Context` value interfaces plus `*Callbacks` callback interfaces) so scene code can reference nodes and variables type-safely. All identifiers route through `buildEnumEntries` → `toSafeIdentifier` (sanitize plus reserved-word guard), and author-controlled `Name` values are emitted with `JSON.stringify`.

**Why:** a raw `Name` interpolated into generated TS is an injection and build-break vector — a `"` or a reserved word like `default` yields non-compiling output. Escape _values_ with `JSON.stringify` and _identifiers_ via `toSafeIdentifier`. **File:** `generateEntityNamesType` / `generateUiEntityNamesType` / `generateUiContextsType` in `packages/inspector/src/lib/data-layer/host/utils/engine-to-composite.ts`.

### Unique UI node names — `generateUniqueUiName`, not `generateUniqueName`

`generateUniqueName` walks `getNodes` (the editor `Nodes` tree), which excludes UiTransform-only UI nodes, so it can't see existing UI names — and the codegen enum-dedup only makes enum _keys_ unique while the `Name` _values_ still collide, breaking `engine.getEntityByName` from scene code. `generateUniqueUiName` scans the `core-schema::Name` component directly for global uniqueness (`Label`, `Label_1`, `Label_2`, …).

**Why:** scene code resolves a UI node by its exact `Name` value via `getEntityByName`; duplicate values are unresolvable. **File:** `generateUniqueUiName` in `packages/inspector/src/lib/sdk/operations/add-child.ts`; used by `add-ui-node.ts` (drag-drop) and `create-ui-root.ts` (roots). **Residual:** `duplicate-ui-node.ts` still copies descendant names verbatim — see Known Residuals.

---

## Gotchas / Watch Points

### asset-packs cross-package VALUE imports need a rebuild first

The asset-packs public API is exported via `src/definitions.ts`, built to `dist/definitions.js` (the package `main`). A **value** import from `@dcl/asset-packs` in the inspector (e.g. `parseHexColor`, `validateVariableDefault`, `VariableType`) only resolves **after** `make build-asset-packs` — the monorepo dependency order is asset-packs → inspector. Editing `variable-codecs.ts` or `ui-runtime.ts` and then running the inspector typecheck without rebuilding asset-packs will fail to resolve the new value export. (Also captured tersely in CLAUDE.md.)

### asset-packs lib build is strict — pure modules only in `src/`

The lib build (`tsc -p tsconfig.lib.json` + `sdk-commands build`) tolerates **no** `vitest` or Node imports in `src/`, and uses `@dcl/sdk/math` types. `variable-codecs.ts` deliberately ships zero test imports and zero node APIs — its **unit tests live in the inspector** (`packages/inspector/src/components/UIDesigner/variable-codecs.spec.ts`), not in asset-packs/src. This is the same trap recorded in CLAUDE.md's "asset-packs unit specs" note: a stray `import … from 'vitest'` in `src/` drags vitest→vite→rollup→`@types/node` global types into the lib build and breaks it with `console`/`Response`/`Worker` conflicts. Cross-reference that note before adding any `.spec.ts` under `asset-packs/src/`.

### Removing a required `FieldConfig` member from object literals fails typecheck

`fixes-1` tried to drop the (unused) `label` from two synthetic `BindableSubField` field literals; this yielded `TS2741: Property 'label' is missing` because `FieldConfig.label` was required. The fix was to make `label?: string` **optional first**, then drop it from the synthetic literals — this blocked an executor mid-run until the type was relaxed. Audit every `.label` read before relaxing such a member (all consumers here — `Block`, `MixedContentField`, React `key`s — already tolerated `undefined`).

### `react-colorful` 5.7.0 ships no `dist/*.css`

Styles inject at runtime via JS, so the CSS-import fallback (`import 'react-colorful/dist/index.css'`) is **N/A** — that path does not exist and would fail to resolve. The package hoists to the repo-root `node_modules` (workspaces), and its `exports` map blocks subpath access (`require('react-colorful/package.json')` throws `ERR_PACKAGE_PATH_NOT_EXPORTED`).

### vitest include glob must list `.spec.tsx`

`vitest.config.js` `include` originally only had `src/**/*.spec.ts`. A vitest CLI path filter is **intersected** with `include`, so a `.spec.tsx` reported "No test files found" until `src/**/*.spec.tsx` was added to the array (esbuild also refuses JSX in a `.ts` file). `vitest run --include …` is not a valid flag in vitest 1.6 — edit the config, not the CLI.

### Validate at the output sink, not (only) the write path

The texture preview had a CSS `url()` injection: validation existed on the **write** path, but the **render** path read the stored value fresh and interpolated it into `background-image: url("…")`. The fix went at the sink — `safeTextureUrl()` in `Canvas.tsx:278` (reject `["'()\\` + whitespace; allowlist `blob:`/`https?:`/`data:image/` schemes), applied in `textureStyle` before the single interpolation point. **General principle:** when a value can reach a sink through a path that bypasses the writer's validation (stale state, imported scene, older build), harden at the sink — it does not depend on every upstream writer being trustworthy.

### `Block` label-row CSS — extend the margin selector, don't drop it

Wrapping `<Label>` in a `.Block-label-row` span moved it out of `.Block`'s direct children, which would have silently stopped `.Block > .Label { margin-bottom: … }` from applying to **every** Block across the whole inspector (Block is widely reused). The fix: extend the selector to `.Block > .Block-label-row` (row carries the margin) and add `.Block-label-row > .Label { margin-bottom: 0 }` (inner Label doesn't double it). Watch for this whenever you reparent a widely-used component's child.

### Attacker-controllable `UIDesign` JSON is parsed defensively

A scene composite is operator-authored but treated as untrusted at the runtime boundary. The `transform`/`text`/`input`/`dropdown`/`background` fields of `asset-packs::UIDesign` are JSON strings parsed by `safeParse`, which rejects non-object shapes and strips prototype-polluting keys (`__proto__`, `prototype`, `constructor`) before the value reaches `createOrReplace`. The per-tick `deepEqual` (the `writeIfChanged` guard) is the only unbounded recursion over that data, so it's capped at depth 32. Two identical `safeParse` copies live in lockstep — `ui-runtime.ts` (runtime) and `ui-design-migration.ts` (inspector load) — because they straddle the `@dcl/js-runtime` vs `@dcl/ecs` package boundary and can't share a module. Keep them in sync.

### `@dcl/js-runtime` has no `console.warn`

The asset-packs runtime runs under `@dcl/js-runtime`, which exposes only `console.log` and `console.error` — `console.warn` is undefined there. Runtime code (`ui-runtime.ts`) logs with `console.error`; the inspector-side copy (`ui-design-migration.ts`, normal browser/Node) uses `console.warn`. Don't copy a `console.warn` into anything under `packages/asset-packs/src/`.

### `docs/specs/` is git-excluded via `.git/info/exclude`

The spec/learnings/review files are excluded locally (not via the shared `.gitignore`), so `git status`-based checks won't surface writes under `docs/specs/`. Worth knowing if a workflow gates on `git status` seeing spec output.

---

## Key Files

| File | Purpose |
| --- | --- |
| `packages/inspector/src/components/UIDesigner/field-configs.ts` | `FieldConfig` schema (`writeAll`, `disabledWhen`, `info`, `bindable`, `mixable`) + the field table |
| `packages/inspector/src/components/UIDesigner/PropertyPanel.tsx` | `FieldRow` switch: renders each kind, applies `disabledWhen`, px↔% on unit switch, fan-out via `expandWriteAll` |
| `packages/inspector/src/components/UIDesigner/Canvas.tsx` | Node rendering: border/radius/zIndex, per-type visuals, `safeTextureUrl`/`textureStyle` preview, node-element registration |
| `packages/inspector/src/components/UIDesigner/measure.ts` | `measureParentBox`/`axisForPath`/`convertLength` — px↔% against the parent box |
| `packages/inspector/src/components/UIDesigner/node-registry.ts` | `Map<number, HTMLElement>` entity→element registry (replaced the `[data-entity]` selector lookup) |
| `packages/inspector/src/components/UIDesigner/useFieldBinding.ts` | Shared bind/unbind + picker state for `BindableField` / `BindableSubField` |
| `packages/inspector/src/components/UIDesigner/TextureField/TextureField.tsx` | 3-variant (File/Avatar/Video) `TextureUnion` picker writing the `$case` shape |
| `packages/inspector/src/components/UIDesigner/VariablePicker/VariablePicker.tsx` | Restricts which variable types a field kind can bind to (`KIND_TO_VARIABLE_TYPES`) |
| `packages/inspector/src/components/UIDesigner/VariablesPanel/VariablesPanel.tsx` | Variable editor: boolean checkbox + color swatch defaults; `validateVariableDefault` on commit |
| `packages/inspector/src/components/ui/RgbaColorField/RgbaColorField.tsx` | `react-colorful` swatch + portal popover Color4 editor |
| `packages/inspector/src/components/ui/RgbaColorField/color.ts` | Color4 ↔ RGBA ↔ hex; `hexToColor4` delegates to shared `parseHexColor` |
| `packages/inspector/src/components/Block/Block.tsx` | Field wrapper; `info` prop → `InfoTooltip` help icon |
| `packages/inspector/src/hooks/useAssetUrl.ts` | Path/URL → blob/object URL (generalized to also feed the canvas texture preview) |
| `packages/asset-packs/src/variable-codecs.ts` | Shared validated codec per `VariableType` (parse/validate/hex/path) |
| `packages/asset-packs/src/ui-runtime.ts` | Engine-native runtime: `createUIRuntimeSystem` derives `core::Ui*` from `asset-packs::UIDesign` each tick; binding/callback resolution; `materialize*`; `writeIfChanged` |
| `packages/asset-packs/src/ui-context.ts` | Scene-code API — `setUiContext` / `setUiCallback` (and clear/read) for variable values and callbacks |
| `packages/asset-packs/src/definitions.ts` | Re-exports `variable-codecs`, the UI context API, and the rest as the package public API (→ `dist/definitions.js`) |
| `packages/inspector/src/lib/data-layer/host/utils/engine-to-composite.ts` | Save-side encode (folds `core::Ui*` into `UIDesign`) + the three name/context codegen generators |
| `packages/inspector/src/lib/data-layer/host/utils/ui-design-migration.ts` | Editor-load split (`splitUIDesignToCore`) + `safeParse` hardening |
| `packages/inspector/src/lib/sdk/operations/tree-walk.ts` | `collectDescendants` — the UiTransform parent-index walker behind every `*-ui-*` op |

---

## Known Residuals / Future Work

Genuinely open items:

- **Avatar / Video texture RUNTIME render is unverified.** The picker writes the `avatarTexture` / `videoTexture` `$case` shapes correctly, but whether react-ecs / Babylon render them in-world was not exercised in this environment.
- **Canvas preview is file-variant only.** Only `texture.$case === 'texture'` (a file `src`) is previewed on the canvas; avatar and video variants show no image preview (background color still shows).
- **Nine-slices preview is approximated as a full stretch.** `textureStyle` has no per-side slice values, so `NINE_SLICES` is rendered as `background-size: 100% 100%` (border-image slicing is out of scope for the preview).
- **Texture `offset` / `tiling` / `wrapMode` / `filterMode` are not exposed** in the editor (only the `texture` union + `textureMode`).
- **Path/encoding denylist is operator-trust only.** `validateAssetPath` and `parseHexColor` are defense-in-depth for an operator authoring their own scene; they are not normalised allowlists. Do not copy them into a context that crosses a trust boundary without decode+normalise+allowlist.
- **Duplicate naming collides on descendants.** `duplicateUINode` names the clone root `"<name> copy"` but copies descendant `Name`s verbatim, so duplicating a subtree can produce colliding names; only `addUINode` and `createUIRoot` use `generateUniqueUiName` today.
- **The render-component pipeline is five explicit touch points.** Adding a `core::Ui*` component means editing the `UIDesign` schema, `UI_RENDER_COMPONENT_NAMES`, the encode loop, `splitUIDesignToCore`, and a `materialize*`. A table-driven descriptor could collapse these into one entry if the set grows.
- **`setUiContext` / `setUiCallback` fail silently on misuse.** Passing a callback to `setUiContext` (or a value to `setUiCallback`) no-ops with no warning; a dev-mode guard would surface it.
