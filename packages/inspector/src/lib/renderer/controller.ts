import { getDataLayerInterface } from '../../redux/data-layer';
import { getConfig } from '../logic/config';
import type { AssetPack } from '../logic/catalog';
import type { InspectorPreferences } from '../logic/preferences/types';
import { registerBabylonRenderer } from './babylon/register';
import { registerBevyRenderer } from './bevy/register';
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
 * Which renderer to mount. Resolution order:
 *   1. the `renderer` config param (a host app like creator-hub driving it), then
 *   2. the localStorage preference (the in-inspector picker), then
 *   3. the default.
 * The config param wins so the host can pin the renderer deterministically per
 * session (and switch it by reloading the iframe with a new param), independent
 * of the iframe origin's localStorage — whose key includes a port that changes
 * each app launch. Falls back if the id is no longer a registered plugin.
 */
export function getSelectedRenderer(): RendererId {
  try {
    const configured = getConfig().renderer;
    if (configured && getRendererPlugin(configured)) return configured;
  } catch {
    // ignore (config unavailable)
  }
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
// renderer uses. Each registration is engine-specific and lives beside its
// renderer (`babylon/register.ts`, `bevy/register.ts`), so this orchestration
// layer stays engine-agnostic.

let builtInsRegistered = false;

/** Register the built-in renderers. Called once before the first build. */
export function registerBuiltInRenderers(
  catalog: AssetPack[],
  preferences: InspectorPreferences,
): void {
  if (builtInsRegistered) return;
  builtInsRegistered = true;
  registerBabylonRenderer(catalog, preferences);
  // Bevy is a preview: the plugin surface + conformance are in place, but the
  // bevy-explorer wasm is not mounted yet, so selecting it renders nothing. It
  // is registered so it shows in the picker and its boundary stays exercised;
  // Babylon remains the default (see DEFAULT_RENDERER).
  registerBevyRenderer();
}

export type { MountedRenderer };
