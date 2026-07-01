import { connectReverseChannel } from '../reverse-channel';
import { registerRenderer } from '../plugin';
import { BevyRenderer } from './BevyRenderer';

/**
 * Bevy renderer registration. Lives here (not in the renderer-agnostic
 * `controller.ts`) so the orchestration layer keeps zero compile-time dependency
 * on Bevy — Bevy is just another plugin behind the public {@link registerRenderer}
 * API, exactly like the built-in Babylon renderer and the Three proof renderer.
 *
 * This is the **conformance spike**: it stands up the Bevy {@link IRenderer}
 * surface and wires the reverse channel, but the bevy-explorer wasm is not
 * mounted yet. The real engine runs out-of-process in an iframe (see the
 * feasibility study); the next slice wires `startRendererIframe` +
 * `@dcl-regenesislabs/bevy-explorer-web` here. Registering now proves the plugin
 * satisfies the boundary and appears in the renderer picker.
 */
export function registerBevyRenderer(): void {
  registerRenderer({
    id: 'bevy',
    label: 'Bevy (preview)',
    mount: ({ canvas }) => {
      // No wasm/iframe yet: the shared (Babylon) canvas is hidden while Bevy is
      // active and restored on dispose, matching the Three renderer's handling.
      // The real mount will create an iframe in `container` for the engine.
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

      return {
        renderer: bevy,
        engine: bevy.context.engine,
        dispose: () => {
          disconnect();
          bevy.dispose();
          canvas.style.display = previousDisplay;
        },
      };
    },
  });
}
