import { getConfig } from '../../logic/config';
import { getSceneClient } from '../../rpc/scene';
import { snapManager } from '../../babylon/decentraland/snap-manager';
import { connectReverseChannel } from '../reverse-channel';
import { registerRenderer } from '../plugin';
import { BevyRenderer } from './BevyRenderer';
import { mountBevyEngine } from './engine-iframe';
import { createCameraBridge } from './camera-bridge';
import { createAnimationsBridge } from './animations-bridge';
import { createDropPointBridge } from './drop-point-bridge';
import { createForwardEditBridge } from './forward-edits';
import { createHotReloadBridge } from './hot-reload-bridge';
import { createInputFocusBridge } from './input-focus-bridge';
import { createLayoutReloadBridge } from './layout-reload-bridge';
import { createVerticalInputBridge } from './vertical-input-bridge';
import { createModifierTracker } from './modifier-tracker';
import { createPickBridge } from './pick-bridge';
import { createPreviewBridge } from './preview-bridge';
import { createSceneRunBridge } from './scene-run-bridge';
import { createSelectionBridge } from './selection-bridge';
import { createSpawnAreasBridge } from './spawn-areas-bridge';
import { createSpawnGizmoBridge } from './spawn-gizmo-bridge';

/**
 * Bevy renderer registration. Lives here (not in the renderer-agnostic
 * `controller.ts`) so the orchestration layer keeps zero compile-time dependency
 * on Bevy — Bevy is just another plugin behind the public {@link registerRenderer}
 * API, exactly like the built-in Babylon renderer and the Three proof renderer.
 *
 * Current state: the engine boots and loads a scene. The bevy-explorer wasm is
 * served same-origin from `public/bevy-engine` (see copy-bevy-engine.ts +
 * build.js COOP/COEP) and mounted in an iframe pointed at a realm; the renderer
 * drives it over the same-origin console seam
 * (contentWindow.engine_console_command_args), the way bevy-editor does.
 *
 * The scene comes from a realm — a content server the engine loads from. Point
 * the `bevyRealm` config (URL param `?bevyRealm=http://localhost:8004`) at a
 * headless `sdk-commands start --no-browser --no-client` serving the project;
 * the engine fetches /about + the scene bundle and runs it. Without a realm the
 * engine loads its default (public) realm and shows no project scene.
 *
 * Editing (viewport pick + translate gizmo) is driven by a super-user editor-
 * agent scene loaded via `bevySystemScene` (?systemScene=). That scene is a
 * SEPARATE SDK7 project at `packages/inspector/agents/bevy` (its own sdk-commands
 * build, excluded from the inspector build); it runs inside the engine's wasm
 * sandbox and talks to this side over the `dcl-editor-bus` BroadcastChannel. The
 * pick-bridge / selection-bridge here are its inspector-side peers.
 */
export function registerBevyRenderer(): void {
  registerRenderer({
    id: 'bevy',
    label: 'Bevy (preview)',
    mount: async ({ canvas, container }) => {
      // The engine runs in its own iframe in the viewport container; the shared
      // (Babylon) canvas is hidden while Bevy is active and restored on dispose.
      const previousDisplay = canvas.style.display;
      canvas.style.display = 'none';

      const bevy = new BevyRenderer();
      // Clicking a code-created entity (present only while the scene runs, not in
      // the authored tree) can't select/edit it — tell the user why, throttled so
      // repeated clicks don't stack toasts (#1418).
      let lastUnauthoredToast = 0;
      const disconnect = connectReverseChannel(
        {
          engine: bevy.context.engine,
          operations: bevy.context.operations,
          editorComponents: bevy.context.editorComponents,
          Transform: bevy.context.Transform,
          rendererEvents: bevy.events,
        },
        {
          // The Bevy agent lives in a separate engine and can't read the entity's
          // base transform, so its gizmo commits are DELTAS (rotation = world-frame
          // delta quaternion, scale = multiplier). Babylon emits absolute values and
          // uses the default (absolute) mode.
          gizmoDeltas: true,
          onPickUnauthored: () => {
            const now = performance.now();
            if (now - lastUnauthoredToast < 4000) return;
            lastUnauthoredToast = now;
            void getSceneClient()?.pushNotification({
              severity: 'info',
              message: "This item was created by the scene's code and can't be edited here.",
            });
          },
        },
      );

      // Boot the engine iframe pointed at the configured realm. `mount` awaits it
      // so the inspector only proceeds once the engine console is live; a boot
      // failure rejects here rather than leaving a half-mounted renderer.
      const config = getConfig();
      const engine = await mountBevyEngine({
        container,
        realm: config.bevyRealm ?? undefined,
        position: config.bevyPosition ?? undefined,
        systemScene: config.bevySystemScene ?? undefined,
        // NOTE: we do NOT launch in preview mode. It would make out-of-bounds items
        // visible (#1391), but in a `--data-layer` editor realm `is_preview=true`
        // also opens a preview socket to the realm, and every edit (a gizmo move
        // writes the CRDT → the data-layer rewrites the scene files) trips the
        // sdk-commands file watcher → SCENE_UPDATE → the engine RELOADS the scene
        // mid-edit. The engine only skips that reload for scenes flagged
        // `ctx.inspected`, which is set by its `--inspect`/debug-UI path — NOT by
        // the editor's `/set_scene` pin — so the guard never fires here and the
        // scene reloads on every gizmo drag (freeze → gizmo detaches → auto-start →
        // play/pause dead). #1391 must be fixed engine-side instead (gate the
        // show-outside-bounds tag on the editor/inspection context, not is_preview).
      });
      bevy.attachEngine(engine.engineWindow);

      // Bindings tied to the engine's WINDOW (its iframe contentWindow): the edit
      // forward, gizmo preview, focus forwarding and E/Q capture. A layout reload
      // (#1369) reboots the engine iframe, replacing that window — so these are
      // held in mutable holders and rebuilt against the new window on reload (the
      // bus-based bridges below survive a reboot, and `modifiers` is retargeted).
      let forwardBridge: ReturnType<typeof createForwardEditBridge> | null = null;
      let disconnectPreview = () => {};
      let disconnectInputFocus = () => {};
      let disconnectVertical = () => {};

      const rewireEngineBindings = (engineWindow: typeof engine.engineWindow) => {
        forwardBridge?.disconnect();
        disconnectPreview();
        disconnectInputFocus();
        disconnectVertical();

        bevy.attachEngine(engineWindow);
        modifiers.retarget(engineWindow as unknown as Window);

        // Forward inspector edits into the running engine scene as console commands
        // (the only live-edit path — the loaded scene has no CRDT channel back in).
        forwardBridge = createForwardEditBridge({
          context: bevy.context,
          engineWindow,
          // On arm, pause loaded Animator clips if the scene is frozen (#1382).
          isFrozen: () => !sceneRunBridge.isRunning(),
        });

        // Live gizmo preview: a drag emits `previewTransforms` every frame (merged
        // by the reverse-channel, not written to the CRDT). Push each straight to
        // the engine console so the entity tracks the gizmo live, without a
        // per-frame undo entry — the committed write lands once on drag-end.
        disconnectPreview = createPreviewBridge({
          events: bevy.events,
          engineWindow,
        });

        // Input focus: the engine iframe is same-origin, so when the viewport holds
        // focus its keydowns go to the engine window. Forward editor shortcuts up
        // to the host so they fire regardless of focus, and refocus the iframe on
        // viewport pointer-down so the fly camera's WASD resumes.
        disconnectInputFocus = createInputFocusBridge({
          engineWindow: engineWindow as unknown as Window,
          iframe: engine.iframe,
        });

        // E/Q vertical fly movement: no SDK InputAction is bound to Q, so the
        // engine can't read it. Capture E/Q on the engine window and forward the
        // held state to the agent's fly camera over the camera bridge.
        disconnectVertical = createVerticalInputBridge({
          engineWindow: engineWindow as unknown as Window,
          onChange: (up, down) => cameraBridge.setVertical(up, down),
        });
      };

      // A viewport pick is a multi-select when Shift/Ctrl/Cmd is held. The agent
      // (wasm sandbox) can't read DOM modifiers, so the host tracks their live
      // state from the same-origin engine + host windows and the pick bridge
      // consults it.
      const modifiers = createModifierTracker({
        engineWindow: engine.engineWindow as unknown as Window,
      });

      // Reverse channel: the editor-agent portable experience (loaded via
      // systemScene) posts viewport picks over a BroadcastChannel; turn them
      // into `pick` events for the reverse-channel handler → ECS selection.
      // Only meaningful when a systemScene agent is configured.
      const disconnectPick = createPickBridge({
        events: bevy.events,
        isMultiSelect: () => modifiers.isMultiSelect(),
        // Convert committed/previewed gizmo world positions into each entity's
        // local frame so nested children don't jump by their parent's offset.
        worldToLocalPosition: (entity, world) => bevy.context.worldToLocalPosition(entity, world),
      });

      // Forward the inspector's selection to the agent so its gizmo attaches to
      // the selected entity (from a viewport pick OR a tree click). The gizmos
      // handle carries the "align to world" setting; the snap handle carries the
      // Snap panel's increments (null while snapping is off).
      const disconnectSelection = createSelectionBridge({
        context: bevy.context,
        gizmos: bevy.gizmos,
        snap: {
          // Holding Shift toggles snapping for the drag (#1375): the Snap panel's
          // enabled state is the base, and Shift inverts it — snap on → smooth,
          // snap off → snapped. Matches Babylon's `initKeyboard`.
          getSnap: () => {
            const snapping = snapManager.isEnabled() !== modifiers.isShift();
            return snapping
              ? {
                  position: snapManager.getPositionSnap(),
                  rotation: snapManager.getRotationSnap(),
                  scale: snapManager.getScaleSnap(),
                }
              : null;
          },
          // Re-post the selection both when the Snap panel changes AND when Shift
          // is pressed/released (Shift inverts the snap live during a drag).
          onChange: cb => {
            const offSnap = snapManager.onChange(cb);
            const offShift = modifiers.onShiftChange(cb);
            return () => {
              offSnap?.();
              offShift();
            };
          },
        },
      });

      // Drag-drop placement: the agent raycasts the ground under the pointer and
      // replies over the bus; wire it into the renderer's getPointerWorldPoint.
      const dropPoint = createDropPointBridge();
      bevy.setDropPointResolver(ndc => dropPoint.query(ndc));

      // Animator: the agent reads an entity's GLTF animation clip names from the
      // engine (GltfContainerLoadingState) and replies over the bus; wire it into
      // getEntityAnimations so the Animator panel's clip dropdown populates.
      const animations = createAnimationsBridge();
      bevy.setAnimationsResolver(entity => animations.query(entity as number));

      // Editor camera: the toggle posts the chosen mode to the agent, which
      // enacts the fly-camera takeover in the engine. The agent also streams the
      // fly-camera's live pose back (scene-local) so the minimap tracks it —
      // mirror it into the renderer's pose (what camera.getPose() reports).
      const cameraBridge = createCameraBridge({
        onPose: ({ position, target }) => {
          bevy.camera.setPose(position, target);
          // The Bevy engine renders in its own iframe, so there's no in-process
          // render loop to drive `viewport.onFrame` subscribers (the minimap).
          // The agent streams the camera pose every few engine frames regardless
          // of movement, so treat each pose as a frame tick — it's a steady
          // ~10fps signal that redraws the minimap (camera indicator + entity
          // dots) with fresh data.
          bevy.context.tick();
        },
        // Default to the FREE editor camera (QA), FRAMED on the scene. The agent
        // boots in avatar (avoids the free-on-boot input race); once it's ready we
        // reset the camera — which engages free AND flies it to a default framing
        // of the scene (scene-local center). A bare set-camera free would seed the
        // fly pose from the avatar cam, which sits far from the scene's real parcel
        // (the "camera really far from the scene" bug). Fires again after a reboot.
        onReady: () => bevy.camera.reset(),
      });
      bevy.setCameraModePoster(mode => cameraBridge.setMode(mode));
      bevy.setFocusPoster(position => cameraBridge.focus(position));
      bevy.setResetPoster(position => cameraBridge.reset(position));
      bevy.setZoomPoster(delta => cameraBridge.zoom(delta));

      // Scene run/freeze: the toolbar toggle posts the intent to the agent, which
      // runs /freeze_scene or /unfreeze_scene on the pinned scene. Default frozen
      // (the agent freezes on boot); the toggle runs it live.
      const sceneRunBridge = createSceneRunBridge({
        // The agent finished a Stop/reset: the reloaded scene is re-pinned +
        // re-frozen. Now — and ONLY now, not on a blind timeout — replay the editor
        // overrides + animation pause (#1421: without this the fresh GLTFs animate
        // for a beat) and release the Play guard (#1420: a fast Stop→Play no longer
        // lands on an unpinned scene). reconcileAfterReload re-freezes animations as
        // part of re-applying overrides.
        onResetComplete: () => {
          forwardBridge?.reconcileAfterReload();
          bevy.notifyResetComplete();
        },
      });
      bevy.setSceneRunPoster(running => {
        sceneRunBridge.setRunning(running);
        // #1382: freezing stops the SDK7 tick but not the engine's GLTF animation
        // playback — so also pause/resume Animator clips with the run state.
        forwardBridge?.setAnimationsFrozen(!running);
      });

      // Hot-reload on scene-code change (#1419). `sdk-commands start` watches the
      // project and broadcasts SCENE_UPDATE over the realm-root WS on any file
      // change; on a code edit we reload the editor scene via the same Stop/reset
      // path (reload + re-pin + reconcile). The catch: in --data-layer mode that
      // message carries no filename and ALSO fires when the data-layer rewrites
      // main.crdt for the inspector's OWN edits — so reloading on every one would
      // reload on every gizmo drag (the #1391 regression). Suppress a SCENE_UPDATE
      // that lands within a short quiet window after any local CRDT change; only an
      // update with no recent local edit (an external code save) reloads.
      let lastLocalEdit = 0;
      const LOCAL_EDIT_QUIET_MS = 1500;
      const HOT_RELOAD_DEBOUNCE_MS = 400;
      const offLocalEdit = bevy.context.onChange(() => {
        lastLocalEdit = performance.now();
      });
      let hotReloadTimer: ReturnType<typeof setTimeout> | null = null;
      const disconnectHotReload = createHotReloadBridge({
        realmUrl: config.bevyRealm,
        onSceneUpdate: () => {
          // Our own edit just rewrote the scene files — ignore (not a code change).
          if (performance.now() - lastLocalEdit < LOCAL_EDIT_QUIET_MS) return;
          // Coalesce a burst of file events (a save can touch several files) into
          // one reload once it settles.
          if (hotReloadTimer !== null) clearTimeout(hotReloadTimer);
          hotReloadTimer = setTimeout(() => {
            hotReloadTimer = null;
            // Re-check the quiet window at fire time (an edit may have landed while
            // debouncing), then reload via the reset path (reload + reconcile).
            if (performance.now() - lastLocalEdit < LOCAL_EDIT_QUIET_MS) return;
            // Preserve the RUN state across a hot-reload: reset() always lands
            // frozen (the Stop default), but a code edit while the user is running
            // the scene should keep running with the new code (like the preview
            // window). Capture whether it was playing BEFORE reset flips it, then
            // re-request Play — reset() defers it (#resetting guard) and applies it
            // on reset-complete, so the reloaded scene resumes.
            const wasRunning = bevy.sceneRun.isRunning();
            void bevy.sceneRun.reset();
            if (wasRunning) bevy.sceneRun.setRunning(true);
          }, HOT_RELOAD_DEBOUNCE_MS);
        },
      });

      // Wire the engine-window bindings for the initial boot. Re-run on reboot.
      rewireEngineBindings(engine.engineWindow);

      // Reboot the engine iframe from scratch: re-navigates it (re-fetching the
      // realm's /about + scene bundle = the scene's authored INITIAL state) and
      // re-wires the engine-window bindings against the new window. Shared by the
      // layout-reload bridge (#1369) and Stop/reset (#1376). A fresh boot re-runs
      // the initial CRDT load burst, so the forward bridge re-arms and re-applies
      // the editor visibility overrides.
      const rebootEngine = async () => {
        const engineWindow = await engine.reload();
        rewireEngineBindings(engineWindow);
      };

      // Parcel-layout changes (#1369): the engine reads its parcel bounds from the
      // realm's /about at BOOT — a runtime `reload` re-runs the scene code but does
      // NOT re-read dimensions, so the only way to reflect a layout edit is a full
      // engine reboot (what close/reopen does). Watch the Scene component's parcels
      // and reboot when they change; re-assert the current freeze/run state
      // afterwards (the agent's boot-freeze applied to the OLD engine is gone).
      const disconnectLayoutReload = createLayoutReloadBridge({
        context: bevy.context,
        reboot: rebootEngine,
        onReloaded: () => sceneRunBridge.setRunning(sceneRunBridge.isRunning()),
      });

      // Stop/reset (#1376): restart the inspected scene to its initial state, then
      // freeze it (the editor default). Play/Pause only run/halt the scene where it
      // is; this is the way back to the start. Uses the agent's scene-scoped
      // `reload` (fast — NO engine/iframe reboot, unlike a layout change which must
      // reboot to re-read dimensions); a freshly reloaded scene starts running, so
      // re-assert freeze right after.
      bevy.setSceneResetter(async () => {
        // Ask the agent to reload+re-pin+re-freeze the scene. BevyRenderer.reset
        // already flipped the local run-state to frozen (so the button reads Play
        // at once) and raised its reset guard (blocking Play until done). The reload
        // re-CREATES the scene's engine entities, dropping every editor override
        // (placeholder GLTFs, editor visibility, pointer-pickable mask, animation
        // pause) — those, and the animation freeze that stops the fresh GLTFs from
        // animating (#1421), are replayed in onResetComplete when the agent confirms
        // the scene is ready — NOT on a blind timeout (which raced the reload and
        // left animations running / Play in a false state, #1420/#1421).
        //
        // Mark the bridge frozen NOW (Stop lands paused regardless of the prior
        // run state). This is load-bearing for #1421: if the scene was PLAYING
        // before Stop, sceneRunBridge.isRunning() would still be true, so the
        // forward bridge's isFrozen() would be false and reconcileAfterReload would
        // SKIP re-freezing the reloaded GLTF animations — they'd keep playing after
        // Stop. Setting it false here makes isFrozen() true, so the reconcile on
        // reset-complete forwards Animator playing:false. It also posts
        // set-scene-frozen so the agent freezes the SDK7 tick.
        // (We don't forward the animation freeze right here — the scene is being
        // reloaded and is momentarily unpinned, so the forward would fail; the
        // reconcile at reset-complete does it once the scene is pinned again.)
        sceneRunBridge.setRunning(false);
        sceneRunBridge.reset();
      });

      // Spawn-point handle: the controller shows/hides the move-handle via the
      // bridge; the agent reports drags back, which the bridge routes to the
      // controller → the active spawn point's form (onPositionChange).
      const spawnGizmo = createSpawnGizmoBridge({
        onCommit: position => bevy.handleSpawnGizmoCommit(position),
        // A viewport click on a spawn point's avatar / camera-target marker selects
        // that spawn point + target (#2). Mirror what the tree does: select it in
        // the spawn controller AND set the ECS Selection to the Player entity — the
        // spawn point is represented in the tree/selection by Player, so this keeps
        // the two selection systems in sync (without it, the entity selection stays
        // on the previously-selected entity and picking desyncs). dispatch() flushes
        // the Selection write (also clears the prior entity's Selection, since it's
        // a single-select updateSelectedEntity).
        onPick: (index, target) => {
          if (target === 'cameraTarget') bevy.spawnPoints.selectCameraTarget(index);
          else bevy.spawnPoints.select(index);
          bevy.context.operations.updateSelectedEntity(bevy.context.engine.PlayerEntity);
          void bevy.context.operations.dispatch();
        },
      });
      bevy.setSpawnGizmoPoster(position => spawnGizmo.show(position));

      // Spawn areas (#1374): draw a translucent box per spawn point (all of them,
      // always visible) so the user sees where the avatar can spawn — including
      // ranges and multiple points. Watches the Scene metadata's spawnPoints and
      // posts the boxes to the agent, which renders them in the viewport.
      const disconnectSpawnAreas = createSpawnAreasBridge({
        context: bevy.context,
        // Honor the tree's per-spawn-point eye toggle: a hidden spawn point's
        // marker is omitted, and toggling re-posts.
        visibility: {
          isHidden: name => bevy.spawnPoints.isHidden(name),
          onChange: cb => bevy.spawnPoints.onVisibilityChange(() => cb()),
        },
      });

      return {
        renderer: bevy,
        engine: bevy.context.engine,
        dispose: () => {
          disconnectVertical();
          disconnectInputFocus();
          modifiers.disconnect();
          disconnectPreview();
          spawnGizmo.disconnect();
          disconnectSpawnAreas();
          sceneRunBridge.disconnect();
          cameraBridge.disconnect();
          dropPoint.disconnect();
          animations.disconnect();
          disconnectSelection();
          disconnectPick();
          disconnectLayoutReload();
          disconnectHotReload();
          offLocalEdit();
          if (hotReloadTimer !== null) clearTimeout(hotReloadTimer);
          forwardBridge?.disconnect();
          disconnect();
          engine.dispose();
          bevy.dispose();
          canvas.style.display = previousDisplay;
        },
      };
    },
  });
}
