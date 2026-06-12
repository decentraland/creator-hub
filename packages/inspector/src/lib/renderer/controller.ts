import type { IEngine } from '@dcl/ecs';

import { getDataLayerInterface } from '../../redux/data-layer';
import { initRenderer } from '../babylon/setup/init';
import { SceneContext } from '../babylon/decentraland/SceneContext';
import { getHardcodedLoadableScene } from '../sdk/test-local-scene';
import type { AssetPack } from '../logic/catalog';
import type { InspectorPreferences } from '../logic/preferences/types';
import { BabylonRenderer } from './babylon/BabylonRenderer';
import { ThreeRenderer } from './three/ThreeRenderer';
import { connectReverseChannel } from './reverse-channel';
import type { IRenderer } from './types';

export type RendererId = 'babylon' | 'three';

export const AVAILABLE_RENDERERS: { id: RendererId; label: string }[] = [
  { id: 'babylon', label: 'Babylon.js' },
  { id: 'three', label: 'Three.js' },
];

const STORAGE_KEY = 'inspector:renderer';

/**
 * Which renderer to mount. Persisted in localStorage and applied at init —
 * switching renderers reloads the inspector (the editor UI is wired to the
 * Babylon scene in places, so a clean reload is simpler and safer than a live
 * swap). See {@link RendererPicker}.
 */
export function getSelectedRenderer(): RendererId {
  try {
    const value = globalThis.localStorage?.getItem(STORAGE_KEY);
    return value === 'three' ? 'three' : 'babylon';
  } catch {
    return 'babylon';
  }
}

export function setSelectedRenderer(id: RendererId): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, id);
  } catch {
    // ignore (storage unavailable)
  }
}

const SCENE_URN =
  'urn:decentraland:entity:bafkreid44xhavttoz4nznidmyj3rjnrgdza7v6l7kd46xdmleor5lmsxfm1';

/**
 * What `createSdkContext` gets from building a renderer: the IRenderer itself,
 * its ECS engine (to wire to the CRDT stream), and — for Babylon — the raw
 * setup bundle + SceneContext the scene RPC server and the not-yet-migrated
 * inspectors still need.
 */
export interface BuiltRenderer {
  id: RendererId;
  renderer: IRenderer;
  engine: IEngine;
  dispose(): void;
  babylon?: ReturnType<typeof initRenderer>;
  sceneContext?: SceneContext;
}

/** In-process asset loading via the data layer (used by the three renderer). */
async function loadAssetFromDataLayer(src: string): Promise<Uint8Array | null> {
  const dataLayer = getDataLayerInterface();
  if (!dataLayer || !src) return null;
  try {
    const response = await dataLayer.getAssetData({ path: src });
    return response.data;
  } catch {
    return null;
  }
}

/** Build the selected renderer. Babylon uses the given canvas; three creates its own. */
export function buildRenderer(
  id: RendererId,
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  catalog: AssetPack[],
  preferences: InspectorPreferences,
): BuiltRenderer {
  if (id === 'three') {
    const threeCanvas = document.createElement('canvas');
    threeCanvas.className = 'three-canvas';
    threeCanvas.style.width = '100%';
    threeCanvas.style.height = '100%';
    canvas.style.display = 'none';
    container.appendChild(threeCanvas);

    const three = new ThreeRenderer(threeCanvas, loadAssetFromDataLayer);
    return {
      id,
      renderer: three,
      engine: three.context.engine,
      dispose: () => {
        three.dispose();
        threeCanvas.remove();
        canvas.style.display = '';
      },
    };
  }

  const babylon = initRenderer(canvas, preferences);
  const ctx = new SceneContext(
    babylon.engine,
    babylon.scene,
    getHardcodedLoadableScene(SCENE_URN, catalog),
  );
  ctx.rootNode.position.set(0, 0, 0);

  const adapter = new BabylonRenderer(ctx, babylon.editorCamera);
  const disconnectReverseChannel = connectReverseChannel(ctx);

  return {
    id: 'babylon',
    renderer: adapter,
    engine: ctx.engine,
    babylon,
    sceneContext: ctx,
    dispose: () => {
      disconnectReverseChannel();
      adapter.dispose();
    },
  };
}
