import { initRenderer } from '../../babylon/setup/init';
import { SceneContext } from '../../babylon/decentraland/SceneContext';
import { getHardcodedLoadableScene } from '../../sdk/test-local-scene';
import type { AssetPack } from '../../logic/catalog';
import type { InspectorPreferences } from '../../logic/preferences/types';
import { connectReverseChannel } from '../reverse-channel';
import { registerRenderer } from '../plugin';
import { BabylonRenderer } from './BabylonRenderer';

/**
 * Babylon-specific renderer registration. Lives here (not in the renderer-
 * agnostic `controller.ts`) so the orchestration layer keeps zero compile-time
 * dependency on Babylon — Babylon is just another plugin behind the public
 * {@link registerRenderer} API.
 */

const SCENE_URN =
  'urn:decentraland:entity:bafkreid44xhavttoz4nznidmyj3rjnrgdza7v6l7kd46xdmleor5lmsxfm1';

/**
 * The raw Babylon bits the inspector's scene-RPC server needs (screenshots,
 * camera control). Exposed through `MountedRenderer.internals` — a Babylon-only
 * escape hatch that the renderer-agnostic core never references by type.
 */
export interface BabylonInternals {
  babylon: ReturnType<typeof initRenderer>;
  sceneContext: SceneContext;
}

/** Type guard for narrowing `MountedRenderer.internals` back to Babylon's. */
export function asBabylonInternals(internals: unknown): BabylonInternals | null {
  if (internals && typeof internals === 'object' && 'sceneContext' in internals) {
    return internals as BabylonInternals;
  }
  return null;
}

/** Register the built-in Babylon renderer. Idempotent per id (registry dedupes). */
export function registerBabylonRenderer(
  catalog: AssetPack[],
  preferences: InspectorPreferences,
): void {
  registerRenderer({
    id: 'babylon',
    label: 'Babylon.js',
    mount: ({ canvas }) => {
      canvas.style.display = '';
      const babylon = initRenderer(canvas, preferences);
      const sceneContext = new SceneContext(
        babylon.engine,
        babylon.scene,
        getHardcodedLoadableScene(SCENE_URN, catalog),
      );
      sceneContext.rootNode.position.set(0, 0, 0);
      const adapter = new BabylonRenderer(sceneContext, babylon.editorCamera);
      const disconnect = connectReverseChannel(sceneContext);
      const internals: BabylonInternals = { babylon, sceneContext };
      return {
        renderer: adapter,
        engine: sceneContext.engine,
        internals,
        dispose: () => {
          disconnect();
          adapter.dispose();
          // Tear down the Babylon engine/scene + its CRDT transport so the
          // WebGL context and observers don't leak on renderer teardown.
          babylon.dispose();
          sceneContext.dispose();
        },
      };
    },
  });
}
