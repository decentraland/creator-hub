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
import { getRegisteredRenderers, getRendererPlugin, registerRenderer } from './plugin';
import type { MountedRenderer, RendererMountContext } from './plugin';

/** A renderer id is now an open string (any registered plugin), not a fixed union. */
export type RendererId = string;

const DEFAULT_RENDERER: RendererId = 'babylon';
const STORAGE_KEY = 'inspector:renderer';

/** The renderers available to pick, in registration order. */
export function getAvailableRenderers(): { id: string; label: string }[] {
  return getRegisteredRenderers().map(({ id, label }) => ({ id, label }));
}

/**
 * Which renderer to mount. Persisted in localStorage and applied at init —
 * switching renderers reloads the inspector (the editor UI is wired to the
 * scene in places, so a clean reload is simpler and safer than a live swap).
 * Falls back to the default if the persisted id is no longer registered.
 */
export function getSelectedRenderer(): RendererId {
  try {
    const value = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (value && getRendererPlugin(value)) return value;
  } catch {
    // ignore (storage unavailable)
  }
  return DEFAULT_RENDERER;
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

/** Raw Babylon bits the inspector's scene RPC server needs (Babylon-only). */
export interface BabylonInternals {
  babylon: ReturnType<typeof initRenderer>;
  sceneContext: SceneContext;
}

/** What `createSdkContext` gets from building the selected renderer. */
export interface BuiltRenderer extends MountedRenderer {
  id: RendererId;
  /** Present only for the built-in Babylon renderer (scene RPC server uses it). */
  babylonInternals?: BabylonInternals;
}

/** In-process asset loading via the data layer. */
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

/**
 * Build the selected renderer through the open plugin registry. The id resolves
 * to a registered {@link RendererPlugin} (built-in or third-party); its `mount`
 * brings the renderer up and returns its IRenderer + engine.
 */
export async function buildRenderer(
  id: RendererId,
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  _catalog: AssetPack[],
  _preferences: InspectorPreferences,
): Promise<BuiltRenderer> {
  const plugin = getRendererPlugin(id) ?? getRendererPlugin(DEFAULT_RENDERER);
  if (!plugin) throw new Error(`No renderer registered for "${id}"`);

  const ctx: RendererMountContext = {
    canvas,
    container,
    loadAsset: loadAssetFromDataLayer,
    connectReverseChannel,
  };
  const mounted = await plugin.mount(ctx);
  return { id: plugin.id, ...mounted };
}

// --- Built-in renderer plugins ---------------------------------------------
// Babylon and Three.js register through the same public API a third party uses.

let builtInsRegistered = false;

/** Register the built-in renderers. Called once before the first build. */
export function registerBuiltInRenderers(
  catalog: AssetPack[],
  preferences: InspectorPreferences,
): void {
  if (builtInsRegistered) return;
  builtInsRegistered = true;

  registerRenderer({
    id: 'babylon',
    label: 'Babylon.js',
    mount: ({ canvas }) => {
      canvas.style.display = '';
      const babylon = initRenderer(canvas, preferences);
      const ctx = new SceneContext(
        babylon.engine,
        babylon.scene,
        getHardcodedLoadableScene(SCENE_URN, catalog),
      );
      ctx.rootNode.position.set(0, 0, 0);
      const adapter = new BabylonRenderer(ctx, babylon.editorCamera);
      const disconnect = connectReverseChannel(ctx);
      const built: BuiltRenderer = {
        id: 'babylon',
        renderer: adapter,
        engine: ctx.engine,
        babylonInternals: { babylon, sceneContext: ctx },
        dispose: () => {
          disconnect();
          adapter.dispose();
        },
      };
      return built;
    },
  });

  registerRenderer({
    id: 'three',
    label: 'Three.js',
    mount: ({ canvas, container, loadAsset }) => {
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

export type { MountedRenderer };
export type { IEngine };
