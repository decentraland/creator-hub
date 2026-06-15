import type { Transport } from '@dcl/mini-rpc';
import { MessageTransport } from '@dcl/mini-rpc';

import type { RendererTransport } from './protocol';
import { createRpcRendererTransport } from './rpc-transport';

/**
 * Mounts an out-of-process renderer in a child `<iframe>` and returns a
 * {@link RendererTransport} talking to it over `postMessage`.
 *
 * Topology: the inspector (itself an iframe inside creator-hub) becomes the
 * *parent* of the renderer iframe. The renderer document (a Unity WebGL build,
 * a Bevy/WASM page, …) loads its own engine and runs `serveRendererHost` against
 * a `MessageTransport(window, window.parent, origin)` on its side; here we build
 * the matching `MessageTransport(window, iframe.contentWindow, origin)`.
 *
 * Mounting is injectable (`opts.mount`) so the wiring is unit-testable without a
 * real iframe — a test can return an in-memory `Transport`. The default creates
 * a real iframe and a postMessage `MessageTransport` to it.
 */

export interface IframeMount {
  /** A mini-rpc transport to the renderer context. */
  transport: Transport;
  /** Tear down the iframe element / underlying channel. */
  dispose(): void;
}

export interface IframeTransportOptions {
  /** URL of the renderer document to load in the iframe. */
  url: string;
  /** Element to attach the iframe to. Defaults to document.body. */
  container?: HTMLElement;
  /** Reject if the iframe hasn't loaded within this many ms (default 30000). */
  loadTimeoutMs?: number;
  /**
   * Override iframe + transport creation (tests inject an in-memory transport).
   * Must resolve once the renderer document has loaded and the transport is
   * ready to carry the mini-rpc connection handshake.
   */
  mount?: (opts: {
    url: string;
    origin: string;
    container: HTMLElement;
    loadTimeoutMs?: number;
  }) => Promise<IframeMount>;
}

/** Default ceiling for the iframe to fire `load`. A renderer document that
 * stalls (CSP block, network hang, sandbox that never loads) emits neither
 * `load` nor `error`, so without this the mount promise hangs forever. */
const DEFAULT_LOAD_TIMEOUT_MS = 30_000;

function defaultMount({
  url,
  origin,
  container,
  loadTimeoutMs = DEFAULT_LOAD_TIMEOUT_MS,
}: {
  url: string;
  origin: string;
  container: HTMLElement;
  loadTimeoutMs?: number;
}): Promise<IframeMount> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.style.border = 'none';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.setAttribute('allow', 'autoplay; fullscreen; xr-spatial-tracking');
    // Sandbox the renderer document: it may run untrusted third-party code.
    // `allow-scripts` (run the renderer) + `allow-same-origin` (so it can use
    // WebGL/asset URLs and postMessage with a real origin) is the minimum a
    // renderer needs; everything else (top-nav, popups, forms) stays denied.
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    iframe.setAttribute('referrerpolicy', 'no-referrer');

    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      iframe.remove();
      reject(new Error(`Renderer iframe (${url}) did not load within ${loadTimeoutMs}ms`));
    }, loadTimeoutMs);

    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      iframe.remove();
      reject(new Error(message));
    };

    iframe.addEventListener('load', () => {
      if (settled) return;
      const contentWindow = iframe.contentWindow;
      if (!contentWindow) {
        fail(`Renderer iframe (${url}) has no contentWindow`);
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve({
        transport: new MessageTransport(window, contentWindow, origin),
        dispose: () => iframe.remove(),
      });
    });
    iframe.addEventListener('error', () => fail(`Failed to load renderer iframe: ${url}`));

    container.appendChild(iframe);
  });
}

/**
 * Create a {@link RendererTransport} backed by a renderer iframe. Resolves once
 * the iframe has loaded; the returned transport's `dispose()` removes it.
 */
export async function createIframeRendererTransport(
  options: IframeTransportOptions,
): Promise<RendererTransport> {
  const container = options.container ?? (typeof document !== 'undefined' ? document.body : null);
  if (!container) {
    throw new Error(
      'createIframeRendererTransport: no container element (pass options.container or options.mount)',
    );
  }
  const mount = options.mount ?? defaultMount;
  const origin = new URL(options.url, window.location.href).origin;

  const mounted = await mount({
    url: options.url,
    origin,
    container,
    loadTimeoutMs: options.loadTimeoutMs,
  });
  const rpc = createRpcRendererTransport(mounted.transport);

  // Forward the full RPC transport (including onRequest/requestInspector for the
  // asset channel) and only override dispose to also tear down the iframe.
  return {
    ...rpc,
    dispose() {
      rpc.dispose();
      mounted.dispose();
    },
  };
}
