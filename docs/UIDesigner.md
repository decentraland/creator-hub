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
