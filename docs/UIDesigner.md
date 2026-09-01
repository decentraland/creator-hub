# UI Designer (2D)

The UI Designer is the inspector's 2D mode for authoring a scene's `@dcl/react-ecs` UI as code-as-source. This document covers how to test it and the non-obvious architecture behind its toolbar, tool modes, scene-run controls, multi-node move, and mode persistence. For the parse/splice foundation see [`solutions/feature-implementation/ui-designer-code-as-source.md`](solutions/feature-implementation/ui-designer-code-as-source.md).

Read this when working on the 2D toolbar, the canvas direct-manipulation, or the 2D/3D mode switch.

## Availability (opt-in gate and SDK requirement)

The UI Designer is gated twice, and both gates arrive as **inspector config query params** (`InspectorConfig`, read once per session via `getConfig`) — the same mechanism as `renderer`, not the feature-flag channel. Creator Hub appends them to the iframe URL in `EditorPage`, so changing a setting rebuilds the URL and reloads the iframe with the new value. Its user-facing name is **UI Editor**; the internal code keeps the older `uiDesigner` name.

- **Feature opt-in** (`uiEditorEnabled`). It is an app setting, off by default: **Settings → Experimental → UI Editor** (`settings.guiEditor`, a toggle in the dedicated Experimental tab, alongside the Scene renderer picker). Creator Hub passes it as the `uiEditorEnabled` query param straight from `settings.guiEditor`. `ModeSwitcher` renders nothing when `getConfig().uiEditorEnabled` is false, so the 2D/3D tablist — the only entry into 2D — is absent, and `useRestorePersistedMode` never restores a persisted 2D mode. The standalone dev inspector has no Creator Hub to pass params, so `getConfig` defaults both to `INSPECTOR_DEV_PARSER` (on in dev builds).

- **SDK compatibility** (`uiEditorSupported`). The editor emits `ScreenInsetArea` / `InteractableArea` wrappers and relies on react-ecs' per-device default virtual screen, both of which exist only in `@dcl/sdk` 7.26.0+ (react-ecs 7.26.0). Below that, a generated `src/ui/index.tsx` fails to compile. Creator Hub derives `supportsUiDesigner` from the scene's installed SDK version (`shared/flags.ts`, `editor` slice) and passes it as the `uiEditorSupported` query param. When the feature is on but the scene is incompatible, the 2D tab stays available and entering it renders `SdkUpgradeNotice` (a full-cover dropout) instead of the canvas. **Update SDK** calls the `update_sdk` scene RPC, which runs the SAME canonical update as the "New dependencies version detected" toast (`updatePackages`, guarded by `editor.isInstallingProject` so the two can't double-install) then `fetchSdkCommandsVersion`; on success the inspector reloads itself (`window.location.reload()`) so the scene picks up the new dependency. **Maybe later** switches back to 3D (`togglePanel` off + `uiDesignerOpen: false`).

## Testing the UI Designer

Two environments run the UI Designer, and they differ in ways that decide what a given change can be verified in.

- **Standalone dev inspector** (`npm run start` in `packages/inspector`, open the printed port). Fastest loop, but limited:
  - It runs the **Babylon** renderer, so `sdk.renderer.sceneRun`, `editorCamera`, and `interaction` are absent. The toolbar's Play/Pause/Stop, camera dropdown, and interact toggle only render under **Bevy**, so they can't be exercised here.
  - Its scene is the in-memory `feeded-local-fs` fixture, which re-seeds on every reload. Anything that must survive a reload — notably 2D/3D mode persistence (`inspector::UIState.uiDesignerOpen`) — can't be verified here.
- **Creator Hub app.** Loads the inspector iframe from `packages/inspector/public` at runtime, so rebuilding the inspector's `public/` (the `npm run start` watch) is enough — no Creator Hub rebuild. Use it to test the Bevy scene-run controls and mode persistence.

### Browser automation traps

Beyond the input-commit and hover gotchas in the root `CLAUDE.md`, two traps bite when driving the panel through Chrome automation:

- **Click coordinates are screenshot pixels, not CSS pixels.** They differ by the device-pixel-ratio scale. Multiply a `getBoundingClientRect` value by `screenshotWidth / window.innerWidth` before clicking, or read the target's position straight off a screenshot (screenshots are the ground truth).
- **A JS-dispatched click does not reach React's handlers.** `el.dispatchEvent(new MouseEvent('click'))` leaves React's `onClick` untouched here. Drive UI with real clicks, and use JavaScript only to read state.

### Widget/node icons must be paths-only

Icons shown in a labeled row — the widget palette, the add-widget picker, and the node tree (`shared/widget-icons.tsx` → `WIDGET_ICONS`) — must draw their glyph with `<path>`/`<rect>`/`<circle>`, never an SVG `<text>` element. SVG `<text>` content leaks into the element's DOM `textContent`, so a Label icon with `<text>Aa</text>` makes the row read as "AaLabel". That breaks exact-label matching: the e2e `UIDesignerPanel.spec.ts` `addWidget` uses `pickerRow` with `hasText: /^Label$/`, and root/node rows are addressed by their displayed name. Draw letterforms as strokes.

## The 2D toolbar

The 2D toolbar is a dedicated component, not the shared 3D one. `App` swaps it in by mode: `isUIDesigner ? <UIDesignerToolbar/> : <Toolbar/>`. This mirrors how the left, right, and bottom panels already swap per mode, and keeps 2D-specific wiring out of the shared `Toolbar`.

- `UIDesignerToolbar` reuses `ToolbarButton` and the shared `.Toolbar` CSS for visual parity, and the tool group (`Tools.tsx`) reuses `Gizmos.css` and the gizmo SVG icons so it matches the 3D gizmo bar exactly.
- **No manual save.** The code store writes every splice to disk immediately (`code/store.ts`, "writes are immediate"), so there is no dirty buffer to flush. The toolbar shows a non-interactive "All changes saved" badge, never a floppy or a `save()` dispatch.

### Tool modes

The Free / Move / Resize tools are a session-only Redux value, `uiDesignerTool` (`redux/ui`). The canvas reads it to gate direct manipulation in `Canvas.tsx`:

- `canDragMove` is true for `FREE` or `MOVE`.
- `showResizeHandles` is true for `FREE` or `RESIZE`.

`FREE` (the default) is the union — drag to move and edge handles to resize, both available — so it reproduces the original mode-less behavior. `MOVE` and `RESIZE` are subtractive locks. Rotation has no meaning for flex/Yoga UI, so its button is present but disabled; scale and resize are the same operation, so there is no separate scale tool.

### Grid snap

Canvas drag and resize snap to `DRAG_SNAP_GRID` (10 logical px). The toolbar's Snap dropdown toggles `uiDesignerSnapEnabled` (`redux/ui`); the canvas gates the snap on `snapEnabledRef.current && !e.shiftKey`, so holding **Shift** is still a per-gesture override for free movement.

## Scene-run controls and mode sync

The 2D toolbar mirrors the 3D scene controls — a Play/Pause toggle plus an always-visible Stop — and they exist only under Bevy (`sdk.renderer.sceneRun`).

The subtlety is **run intent**. `sceneRun` exposes only a boolean `isRunning()`, which can't distinguish "paused for editing but was running" from "stopped." So a separate `sceneRunIntent` (`redux/ui`) records what the user wants:

- Both toolbars set `sceneRunIntent` on Play, Pause, and Stop.
- `useSyncSceneRunWithMode` freezes the scene when 2D opens (editing needs a static viewport, because the renderer is only CSS-hidden in 2D) and resumes it when 3D returns, but only if the intent was to run.
- The 2D toolbar displays the intent, so switching to 2D while a scene runs shows **Pause** (it's still your running scene, just frozen), not Play as if it never ran.

**Hot-reload suppression (`register.ts`).** `sdk-commands start` broadcasts `SCENE_UPDATE` on any file change, and under `--data-layer` mode that message carries no filename and also fires when the data-layer rewrites `main.crdt` for the inspector's own edits — so reloading on every one reloads on every gizmo drag (the #1391 regression). A short quiet window after any local edit suppresses those; only an update with no recent local edit (an external code save, #1419) reloads. "Local edit" comes from a shared beacon, not a timestamp stamped here, because there are two writers — CRDT edits and code mode (which writes `src/ui/*.tsx` through the storage bridge and never touches the CRDT).

## Multi-node move

Dragging a multi-selection moves every selected absolute node together and commits in one batch.

- `Canvas/group-drag.ts` is a small shared store. During a drag it holds the live offset, cached per entity so `useSyncExternalStore` re-renders only the participating nodes. On release it hands each node its dropped position for the optimistic hold.
- `spliceUiTransformPositions` (`code/store.ts`) commits all nodes' positions in a single `applySourceEdits`. This batching is mandatory: synthetic node ids are positional per parse, so a per-node splice would reparse between ops and invalidate the ids after the first.

<!-- prettier-ignore -->
> [!IMPORTANT]
> The post-drag click lands on the dragged child at its new position. Its
> `handleClick` recognizes the drag and returns early, but it must also call
> `stopPropagation` — otherwise the click bubbles to the root node, whose
> `handleClick` selects the root and wipes out the multi-selection. The
> suppression flag is module-level in `group-drag.ts` so whichever node receives
> the bubbled click can honor it.

## Mode persistence

The 2D/3D mode rides `inspector::UIState.uiDesignerOpen` on the scene root and is serialized into the composite, so it survives a reload in the Creator Hub app. `useRestorePersistedMode` replays it into Redux on load.

The restore must wait for a **defined** `uiDesignerOpen`, not merely a non-null `uiState`. `useInspectorUIState` surfaces a default (with `uiDesignerOpen` undefined) the instant the sdk exists, before the CRDT stream hydrates the component. Latching on that premature default locks in 3D and ignores a persisted 2D. A scene that never chose a mode keeps `uiDesignerOpen` undefined and correctly stays in the 3D default.

Never add a member to an already-released `inspector::UIState` version in `versioning/registry.ts`: an object schema is a positional `Schemas.Map`, so an extra member overruns buffers written by an older engine ("Outside of the bounds of writen data") even when `Optional`. Append a new version diff to the array instead.

## App shell (mode toggle)

- **`<Renderer />` stays mounted across mode toggles, hidden with CSS, never unmounted.** Babylon's engine/canvas refs don't survive unmount/remount — unmounting kills the GL context. Because it stays live under 2D, its document-level entity hotkeys (Delete / Cmd+D / copy-paste) must be guarded, and the bare camera keys (space/f/+/-) must be *unbound* via `useHotkey({ enabled })` while the designer is open — `useHotkey` preventDefaults before dispatch, so a callback-level guard is not enough (ref #1401).
- **react-resizable-panels layout quirks (`App.tsx`).** The top `<Panel>` omits `defaultSize` — pinning it wouldn't sum to 100 once the bottom panel asks for its 2D height, and the library rescales any layout that doesn't total 100. The bottom panel's `id` switches between `palette` (2D) and `assets` (3D) because the library keys saved layout by `id` and only re-reads it on (un)register, so a shared id would leak one mode's height into the other.
- **`isReady` doubles as the e2e readiness gate**, so it must include `modeResolved` — otherwise tests race the mode restore.

## Scene Inset (screenInset)

Each top-level root is placed in a screen area via react-ecs' `UiScreenInset` (`'device'` | `'interactable'` | `'none'`), chosen with the **Scene Inset** dropdown in the property panel. The control shows only for top-level roots (`isGuiRoot && activeRoot.topLevel`) — that is "only for Parents". Default: `'device'`.

The `'device'` option is offered only while previewing **mobile** (`SceneInsetRow` filters on `getPlatform`). On desktop the device safe area equals full screen, so the option is hidden and a stored `'device'` root **displays** as "Full Screen" without rewriting the value — the same root still gives the mobile branch its safe area.

`screenInset` is **not** a `uiTransform` prop. It is applied by WRAPPING the root in the aggregator (`code/aggregator.ts` `generateUiIndex`): `'device'` → `<ScreenInsetArea>`, `'interactable'` → `<InteractableArea>`, `'none'` → unwrapped. The wrapper is emitted only around top-level roots, never inside a component file: `ScreenInsetArea`/`InteractableArea` render `positionType: 'absolute'` with the inset margins, which resolve against the PARENT box, so they land correctly only as a direct child of the full-screen container. A prefab imparted into another component is emitted bare `<Component />`, so the editor can never generate a nested `ScreenInsetArea` (which would double-inset and mis-anchor). Consequence: a root's inset applies only when it renders as a top-level GUI; nested as a prefab, its inset is ignored and the parent positions it.

Persistence lives only in the aggregator source (the wrapper tags themselves). `readRootInsets` recovers each root's wrapper by component name so a regenerate (root add/rename/remove) preserves it; `refreshRoots` carries it forward for known files (like `topLevel`) and reads it from the aggregator for a newly-appeared file. A bare root reads back as `'none'` **only** when the file already uses wrappers — a pre-inset aggregator has none, so its bare roots fall through to the `'device'` default (the migration we want). The one lossy corner: an all-`'none'` scene (zero wrappers) can't be told from a pre-inset one and reloads as `'device'`. The edit path is `setRootScreenInset` (`code/store.ts`), which updates the in-memory root and calls `regenerateAggregator`.

The aggregator no longer writes `{ virtualWidth, virtualHeight }` into `setUiRenderer` — react-ecs defaults the design resolution per device (desktop / mobile 16:9), so a hardcoded desktop resolution no longer forces itself onto the mobile branch. The editor canvas frames against a fixed default (`DEFAULT_CANVAS_WIDTH/HEIGHT`, `shared/tree-model.ts`); `setUiRenderer`'s options arg is optional, so the single-arg emit typechecks against `@dcl/react-ecs`.

Canvas: the active root's inset is drawn as a dashed guide (`Canvas.tsx`, reusing the `.ui-designer-safe-zone` overlay styling) from `insetRect(device, inset)` (`shared/safe-areas.ts`, where `deviceSafeArea` is desktop = full screen, mobile = inside the system bars). The guide shows only for a top-level root, mirroring the aggregator, and is hidden for a fixed-artboard root (see Canvas framing).

## Canvas framing (artboard vs screen) and overflow

The canvas frames the root two ways (`Canvas.tsx`, `fixedRoot`): a root whose width AND height are fixed px (`widthUnit/heightUnit === YGU_POINT`) is an **artboard** — the frame is the root's own box, drawn at true size (`fitScale = 1`, no device-screen letterbox), and the screen-relative overlays (safe-area, inset guide) are hidden. A **full-screen** root (%, auto or unset) keeps the previous behaviour: the fixed default design resolution (`DEFAULT_CANVAS_WIDTH/HEIGHT`) is letterboxed into the previewed device screen. Feeding a fixed 400×400 root into the old `min(screen/virtual)` fit blew it up to fill 1080px — the "canvas not resized to the root" symptom.

Overflow is shown, not clipped: the clip lived on `.ui-designer-canvas-screen` (`overflow: hidden`), which cut nodes at the frame edge. It is now `visible`, and `.ui-designer-canvas-stagewrap` too, so a child larger than the frame renders past it; the outer `.ui-designer-canvas-viewport` still clips at the panel boundary. The mobile `.ui-designer-device-frame` keeps its bezel clip.

## Codegen & runtime gotchas

- **Hotkeys are not built on the shared `useHotkey` hook** (`shared/useUINodeHotkeys.ts`). `useHotkey`'s cleanup unbinds keys *globally*, which would clobber the 3D Renderer's Ctrl+C/V/D/Delete. Undo/redo are also deliberately not handled here — the Toolbar owns Ctrl+Z/Y, and a second document-level listener would double-fire.
- **Scene files arrive as a plain `Uint8Array`, not a Node `Buffer`, over the iframe↔CH RPC** (`code/store.ts` disk read/write). The `Buffer` prototype is lost across the bridge, so `.toString('utf8')` yields a comma-joined byte string (`"47,42,…"`) instead of text. Decode/encode via `TextDecoder`/`TextEncoder` (matching `fs-composite-provider`).
- **Enum string spellings must match react-ecs's own parser keys exactly** (`code/ecs-shape.ts` `ENUM_TO_STRING`) — `'nowrap'` not `'no-wrap'`, `'flex-start'` not `'start'`. A wrong spelling makes the runtime parser return `undefined` and silently fall back to its default, so the whole enum-prop group round-trips as a no-op with no error.
- **Mixed-content binding chips are a trust boundary** (`RightPanel/PropertyPanel/MixedContentField`, `segments.ts`). A chip's `data-variable` is untrusted — a foreign paste/drop/IME node can carry an attacker-chosen value that would be spliced verbatim into a `${…}` template slot. `isSafeBindingExpr` (bare identifier or single-level member access only) gates every segment; paste inserts plain text via a `Range` and drop/dragover are rejected outright. Do not bypass the gate when adding segment sources.
- **Paste into the contentEditable editor must use a `Range`, not `execCommand('insertText')`** — the latter is a silent no-op in Firefox and some Electron isolation contexts, losing the paste.
- **Override/interaction layers write an explicit value, never a removal.** An absent key in an override layer reads as "inherit from the Default layer", so clearing a field there means writing its explicit value, not deleting the key (recurs across `resize-modes.ts`, `flow.ts`, `overflow-flags.ts`, `visibleDisplayValue`). Going absolute also clears all four margins — Yoga adds a node's leading margin on top of an absolute inset, so a surviving margin holds the node off the very edge it is pinned to.
- **`safeTextureUrl` is an output-sink allowlist, not input validation** (`Canvas.tsx`). The resolved texture URL is interpolated into a CSS `url("…")` context on the canvas, so emission rejects any value with a quote/paren/whitespace/backslash and permits only `blob:` / `http(s):` / `data:image/`. This is independent of the TextureField commit-path validation; a rejected value drops the image and the background colour still shows. Keep the allowlist when touching canvas background rendering.
- **Canvas text markup is XSS-safe only because it builds React elements, never `innerHTML`** (`text-markup.tsx`). `PBUiText.value` is author-controlled and reaches the DOM verbatim; React's text-child escaping is the entire safety story, so anything unrecognized (including `<script>`) stays literal text. Never switch this to `dangerouslySetInnerHTML`.
- **Reorder holds the drag translate until the source round-trips** (`Canvas.tsx` `heldOffset`), because a reorder changes the node's source *path*, not its offsets, so `optimisticPos` can't express the dropped state — releasing on mouseup snaps the node back to its old slot for a frame. Relatedly, the `optimisticPos` release check must read an *absent* margin as the `0` it means in Yoga (a cleared margin returns as absent, not `0`), or the hold never releases. (Extends the async direct-manipulation note in the root CLAUDE.md.)
- **Full-fill a node with `flexGrow: 1` + `alignSelf: 'stretch'`, not `width/height: '100%'`** (`code/store-splices.ts` `FULLSCREEN_TEMPLATE`, `RightPanel/PropertyPanel/resize-modes.ts`). `resizeMode` classifies `YGU_PERCENT → 'percent'` and a no-size + grow/stretch axis → `'fill'`, so a `100%` node reads back in the resize panel as **Percent**, not **Fill**. `flexGrow` also cooperates with Yoga free-space (siblings share the axis) where two `100%` children overflow. Emit *both* props so it fills both axes regardless of the parent's `flexDirection` (Yoga defaults to `column`).
