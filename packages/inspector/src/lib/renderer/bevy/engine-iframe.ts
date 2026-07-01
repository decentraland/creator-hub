import type { EngineWindow } from './console';
import { engineReady } from './console';

/**
 * Where the bevy-explorer web bundle is served from. `copy-bevy-engine.ts` copies
 * the installed npm package into `public/bevy-engine/`, and the dev server
 * (build.js) serves it with the COOP/COEP headers the engine wasm needs. The
 * iframe is **same-origin** with the inspector, which is what lets the Bevy
 * renderer reach `contentWindow.engine_console_command_args` directly.
 *
 * The URL points at the **directory** (trailing slash), not `index.html`: the
 * engine's own `main.js` derives its service-worker scope + asset paths from
 * `location.pathname` and assumes a directory root. Pointing at the explicit
 * `.../index.html` makes it compute `/bevy-engine/index.html/service_worker.js`
 * (a 404) and the asset-loader worker crashes. Serving the directory index keeps
 * every document-relative path resolving under `/bevy-engine/`.
 */
export const BEVY_ENGINE_URL = '/bevy-engine/';

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
  /** Override the engine URL (tests / a custom serve path). */
  url?: string;
  /** How long to wait for the engine console to appear before failing. */
  bootTimeoutMs?: number;
  /**
   * Test seam: build the iframe element. Defaults to `document.createElement`.
   * Tests inject a fake with a controllable `contentWindow`.
   */
  createIframe?: () => HTMLIFrameElement;
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
    bootTimeoutMs = DEFAULT_BOOT_TIMEOUT_MS,
    createIframe = () => document.createElement('iframe'),
  } = options;

  const iframe = createIframe();
  iframe.src = url;
  iframe.title = 'Bevy engine';
  iframe.style.border = 'none';
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.setAttribute('allow', 'autoplay; fullscreen; xr-spatial-tracking');
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
