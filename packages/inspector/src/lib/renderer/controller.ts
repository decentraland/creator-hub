import { getDataLayerInterface } from '../../redux/data-layer';
import type { AssetPack } from '../logic/catalog';
import type { InspectorPreferences } from '../logic/preferences/types';
import { registerBabylonRenderer } from './babylon/register';
import { connectReverseChannel } from './reverse-channel';
import { getRegisteredRenderers, getRendererPlugin } from './plugin';
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

/** What `createSdkContext` gets from building the selected renderer. */
export interface BuiltRenderer extends MountedRenderer {
  id: RendererId;
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
// Built-in renderers register through the same public API a third-party
// renderer uses. The Babylon registration is Babylon-specific and lives in
// `babylon/register.ts`, so this orchestration layer stays engine-agnostic.

let builtInsRegistered = false;

/** Register the built-in renderers. Called once before the first build. */
export function registerBuiltInRenderers(
  catalog: AssetPack[],
  preferences: InspectorPreferences,
): void {
  if (builtInsRegistered) return;
  builtInsRegistered = true;
  registerBabylonRenderer(catalog, preferences);
}

export type { MountedRenderer };
