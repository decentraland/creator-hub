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
  /**
   * Override iframe + transport creation (tests inject an in-memory transport).
   * Must resolve once the renderer document has loaded and the transport is
   * ready to carry the mini-rpc connection handshake.
   */
  mount?: (opts: { url: string; origin: string; container: HTMLElement }) => Promise<IframeMount>;
}

function defaultMount({
  url,
  origin,
  container,
}: {
  url: string;
  origin: string;
  container: HTMLElement;
}): Promise<IframeMount> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.style.border = 'none';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.setAttribute('allow', 'autoplay; fullscreen; xr-spatial-tracking');

    iframe.addEventListener('load', () => {
      const contentWindow = iframe.contentWindow;
      if (!contentWindow) {
        reject(new Error(`Renderer iframe (${url}) has no contentWindow`));
        return;
      }
      resolve({
        transport: new MessageTransport(window, contentWindow, origin),
        dispose: () => iframe.remove(),
      });
    });
    iframe.addEventListener('error', () =>
      reject(new Error(`Failed to load renderer iframe: ${url}`)),
    );

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
  const container =
    options.container ?? (typeof document !== 'undefined' ? document.body : undefined);
  const mount = options.mount ?? defaultMount;
  const origin = new URL(options.url, window.location.href).origin;

  const mounted = await mount({ url: options.url, origin, container: container as HTMLElement });
  const rpc = createRpcRendererTransport(mounted.transport);

  return {
    sendCommand: rpc.sendCommand,
    request: rpc.request,
    onOutbound: rpc.onOutbound,
    dispose() {
      rpc.dispose();
      mounted.dispose();
    },
  };
}
