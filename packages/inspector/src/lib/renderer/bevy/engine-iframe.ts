import type { EngineWindow } from './console';
import { engineReady } from './console';

/**
 * Our engine HOST page, served same-origin from `public/bevy-engine/`
 * (copy-bevy-engine.ts copies the npm engine bundle there + adds `engine.html`).
 * The dev server (build.js) + Electron stamp the COOP/COEP headers the engine
 * wasm needs. Same-origin is what lets the Bevy renderer reach
 * `contentWindow.engine_console_command` directly and share the `dcl-editor-bus`.
 *
 * We point at OUR `engine.html`, not the package's root index.html: since the
 * "react-web" engine layout (~commit-4472a75) the package's index.html is the
 * full Decentraland React HUD loaded from a CDN, not an embeddable engine.
 * `engine.html` is a bare host page that boots the engine in-document via its
 * boot contract (`engine/boot.js` + `__bevyLaunch`) — see the file for details.
 * The realm / position / systemScene ride on this page's query string; the host
 * page reads them and drives the launch.
 */
export const BEVY_ENGINE_URL = '/bevy-engine/engine.html';

/** Poll cadence + boot ceiling, matching bevy-editor's proven values. */
const READY_POLL_INTERVAL_MS = 250;
const DEFAULT_BOOT_TIMEOUT_MS = 40_000;

export interface BevyEngineMount {
  iframe: HTMLIFrameElement;
  /** The engine's window — call console commands on it. */
  engineWindow: EngineWindow;
  dispose(): void;
}

export interface MountEngineOptions {
  /** Where to attach the engine iframe (the renderer's viewport container). */
  container: HTMLElement;
  /** Override the engine base URL (tests / a custom serve path). */
  url?: string;
  /**
   * Realm the engine loads the scene from — an HTTP URL to a running content
   * server (e.g. a headless `sdk-commands start --no-browser --no-client`). The
   * engine fetches /about, the scene entity, and the compiled bundle from here.
   * Omit to let the engine load its default (public) realm.
   */
  realm?: string;
  /** Parcel coords to spawn at, e.g. "0,0" (the scene's base). */
  position?: string;
  /**
   * Realm URL of the super-user editor-agent scene, loaded as a portable
   * experience via the engine's `?systemScene=` param. Provides viewport picking.
   */
  systemScene?: string;
  /** How long to wait for the engine console to appear before failing. */
  bootTimeoutMs?: number;
  /**
   * Test seam: build the iframe element. Defaults to `document.createElement`.
   * Tests inject a fake with a controllable `contentWindow`.
   */
  createIframe?: () => HTMLIFrameElement;
}

/**
 * Build the engine iframe URL: our host page (`engine.html`) with `realm`,
 * `position` and `systemScene` on its query string. The host page reads them and
 * drives the engine's boot contract (`__bevyBootConfig` + `__bevyLaunch`) — it
 * also derives `portables` from `systemScene` (empty, to skip the default remote
 * PX). Kept pure + exported for testing.
 */
export function buildEngineUrl(
  base: string,
  realm?: string,
  position?: string,
  systemScene?: string,
): string {
  const params = new URLSearchParams();
  if (realm) params.set('realm', realm);
  if (position) params.set('position', position);
  if (systemScene) params.set('systemScene', systemScene);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

/**
 * Mount the bevy-explorer engine in a same-origin iframe and resolve once its
 * console command API is installed (the engine is "ready"). Rejects if the
 * engine doesn't come up within `bootTimeoutMs`.
 *
 * This is the boot half of the Bevy renderer: it proves the engine loads behind
 * the boundary. Feeding it the scene (CRDT) and driving gizmos/picking are later
 * slices; this only establishes the console seam.
 */
export function mountBevyEngine(options: MountEngineOptions): Promise<BevyEngineMount> {
  const {
    container,
    url = BEVY_ENGINE_URL,
    realm,
    position,
    systemScene,
    bootTimeoutMs = DEFAULT_BOOT_TIMEOUT_MS,
    createIframe = () => document.createElement('iframe'),
  } = options;

  const iframe = createIframe();
  iframe.src = buildEngineUrl(url, realm, position, systemScene);
  iframe.title = 'Bevy engine';
  iframe.style.border = 'none';
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  // `cross-origin-isolated` propagates the embedder's isolation into this frame,
  // which the engine wasm needs for SharedArrayBuffer. Same-origin frames inherit
  // it, but declaring it is explicit and harmless.
  iframe.setAttribute('allow', 'autoplay; fullscreen; xr-spatial-tracking; cross-origin-isolated');
  container.appendChild(iframe);

  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let bootTimer: ReturnType<typeof setTimeout> | null = null;
  let settled = false;

  const cleanupTimers = () => {
    if (pollTimer !== null) clearInterval(pollTimer);
    if (bootTimer !== null) clearTimeout(bootTimer);
    pollTimer = null;
    bootTimer = null;
  };

  const dispose = () => {
    cleanupTimers();
    iframe.remove();
  };

  return new Promise<BevyEngineMount>((resolve, reject) => {
    bootTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      dispose();
      reject(new Error(`Bevy engine (${url}) did not become ready within ${bootTimeoutMs}ms`));
    }, bootTimeoutMs);

    // The engine installs its console function on its own window some time after
    // the iframe's `load` fires (wasm init runs async), so poll `contentWindow`
    // rather than resolving on `load`.
    pollTimer = setInterval(() => {
      if (settled) return;
      const engineWindow = iframe.contentWindow as EngineWindow | null;
      if (!engineReady(engineWindow)) return;
      settled = true;
      cleanupTimers();
      resolve({ iframe, engineWindow: engineWindow as EngineWindow, dispose });
    }, READY_POLL_INTERVAL_MS);
  });
}
