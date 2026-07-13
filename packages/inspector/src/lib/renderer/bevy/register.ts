import { getConfig } from '../../logic/config';
import { snapManager } from '../../babylon/decentraland/snap-manager';
import { connectReverseChannel } from '../reverse-channel';
import { registerRenderer } from '../plugin';
import { BevyRenderer } from './BevyRenderer';
import { mountBevyEngine } from './engine-iframe';
import { createCameraBridge } from './camera-bridge';
import { createDropPointBridge } from './drop-point-bridge';
import { createForwardEditBridge } from './forward-edits';
import { createInputFocusBridge } from './input-focus-bridge';
import { createModifierTracker } from './modifier-tracker';
import { createPickBridge } from './pick-bridge';
import { createSelectionBridge } from './selection-bridge';
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
      const disconnect = connectReverseChannel({
        engine: bevy.context.engine,
        operations: bevy.context.operations,
        editorComponents: bevy.context.editorComponents,
        Transform: bevy.context.Transform,
        rendererEvents: bevy.events,
      });

      // Boot the engine iframe pointed at the configured realm. `mount` awaits it
      // so the inspector only proceeds once the engine console is live; a boot
      // failure rejects here rather than leaving a half-mounted renderer.
      const config = getConfig();
      const engine = await mountBevyEngine({
        container,
        realm: config.bevyRealm ?? undefined,
        position: config.bevyPosition ?? undefined,
        systemScene: config.bevySystemScene ?? undefined,
      });
      bevy.attachEngine(engine.engineWindow);

      // Forward inspector edits into the running engine scene as console
      // commands (the only live-edit path — the loaded scene has no CRDT channel
      // back in). Transform-only for now; see forward-edits.ts.
      const disconnectForward = createForwardEditBridge({
        context: bevy.context,
        engineWindow: engine.engineWindow,
      });

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
      });

      // Forward the inspector's selection to the agent so its gizmo attaches to
      // the selected entity (from a viewport pick OR a tree click). The gizmos
      // handle carries the "align to world" setting; the snap handle carries the
      // Snap panel's increments (null while snapping is off).
      const disconnectSelection = createSelectionBridge({
        context: bevy.context,
        gizmos: bevy.gizmos,
        snap: {
          getSnap: () =>
            snapManager.isEnabled()
              ? {
                  position: snapManager.getPositionSnap(),
                  rotation: snapManager.getRotationSnap(),
                  scale: snapManager.getScaleSnap(),
                }
              : null,
          onChange: cb => snapManager.onChange(cb),
        },
      });

      // Drag-drop placement: the agent raycasts the ground under the pointer and
      // replies over the bus; wire it into the renderer's getPointerWorldPoint.
      const dropPoint = createDropPointBridge();
      bevy.setDropPointResolver(() => dropPoint.query());

      // Editor camera: the toggle posts the chosen mode to the agent, which
      // enacts the fly-camera takeover in the engine.
      const cameraBridge = createCameraBridge();
      bevy.setCameraModePoster(mode => cameraBridge.setMode(mode));
      bevy.setFocusPoster(position => cameraBridge.focus(position));
      bevy.setResetPoster(position => cameraBridge.reset(position));

      // Spawn-point handle: the controller shows/hides the move-handle via the
      // bridge; the agent reports drags back, which the bridge routes to the
      // controller → the active spawn point's form (onPositionChange).
      const spawnGizmo = createSpawnGizmoBridge({
        onCommit: position => bevy.handleSpawnGizmoCommit(position),
      });
      bevy.setSpawnGizmoPoster(position => spawnGizmo.show(position));

      // Input focus: the engine iframe is same-origin, so when the viewport holds
      // focus its keydowns go to the engine window (not ours). Forward editor
      // shortcuts up to the host so they fire regardless of focus, and refocus the
      // iframe on viewport pointer-down so the fly camera's WASD resumes without a
      // deliberate focus click. (engineWindow is the iframe's contentWindow.)
      const disconnectInputFocus = createInputFocusBridge({
        engineWindow: engine.engineWindow as unknown as Window,
        iframe: engine.iframe,
      });

      return {
        renderer: bevy,
        engine: bevy.context.engine,
        dispose: () => {
          disconnectInputFocus();
          modifiers.disconnect();
          spawnGizmo.disconnect();
          cameraBridge.disconnect();
          dropPoint.disconnect();
          disconnectSelection();
          disconnectPick();
          disconnectForward();
          disconnect();
          engine.dispose();
          bevy.dispose();
          canvas.style.display = previousDisplay;
        },
      };
    },
  });
}
