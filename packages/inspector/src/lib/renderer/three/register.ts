import { connectReverseChannel } from '../reverse-channel';
import { registerRenderer } from '../plugin';
import { ThreeRenderer } from './ThreeRenderer';

/**
 * Three.js renderer registration. Lives here (not in the renderer-agnostic
 * `controller.ts`) so the orchestration layer keeps zero compile-time dependency
 * on Three — Three is just another plugin behind the public {@link registerRenderer}
 * API, exactly like the built-in Babylon renderer.
 *
 * Three.js is a minimal, in-process proof renderer: it validates the boundary is
 * genuinely engine-agnostic and serves as a manual test vehicle. It is not
 * intended to reach feature parity with Babylon.
 */
export function registerThreeRenderer(): void {
  registerRenderer({
    id: 'three',
    label: 'Three.js',
    mount: ({ canvas, container, loadAsset }) => {
      // Three renders into its own canvas in the viewport container; the shared
      // (Babylon) canvas is hidden while it's active and restored on dispose.
      const threeCanvas = document.createElement('canvas');
      threeCanvas.className = 'three-canvas';
      threeCanvas.style.width = '100%';
      threeCanvas.style.height = '100%';
      canvas.style.display = 'none';
      container.appendChild(threeCanvas);

      const three = new ThreeRenderer(threeCanvas, loadAsset);
      const disconnect = connectReverseChannel({
        engine: three.context.engine,
        operations: three.context.operations,
        editorComponents: three.context.editorComponents,
        Transform: three.context.Transform,
        rendererEvents: three.events,
      });

      return {
        renderer: three,
        engine: three.context.engine,
        dispose: () => {
          disconnect();
          three.dispose();
          threeCanvas.remove();
          canvas.style.display = '';
        },
      };
    },
  });
}
