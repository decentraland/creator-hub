import { connectReverseChannel } from '../reverse-channel';
import { registerRenderer } from '../plugin';
import { BevyRenderer } from './BevyRenderer';
import { mountBevyEngine } from './engine-iframe';

/**
 * Bevy renderer registration. Lives here (not in the renderer-agnostic
 * `controller.ts`) so the orchestration layer keeps zero compile-time dependency
 * on Bevy — Bevy is just another plugin behind the public {@link registerRenderer}
 * API, exactly like the built-in Babylon renderer and the Three proof renderer.
 *
 * Current state: the engine boots. The bevy-explorer wasm is served same-origin
 * from `public/bevy-engine` (see copy-bevy-engine.ts + build.js COOP/COEP) and
 * mounted in an iframe; the renderer drives it over the same-origin console seam
 * (contentWindow.engine_console_command_args), the way bevy-editor does. Feeding
 * the engine the scene CRDT and wiring gizmos/picking are the next slices — the
 * reverse channel is already connected so those land without touching this file.
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

      // Boot the engine iframe. `mount` awaits it so the inspector only proceeds
      // once the engine console is live; a boot failure rejects here and surfaces
      // to the caller rather than leaving a half-mounted renderer.
      const engine = await mountBevyEngine({ container });
      bevy.attachEngine(engine.engineWindow);

      return {
        renderer: bevy,
        engine: bevy.context.engine,
        dispose: () => {
          disconnect();
          engine.dispose();
          bevy.dispose();
          canvas.style.display = previousDisplay;
        },
      };
    },
  });
}
