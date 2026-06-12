import type { Transport } from '@dcl/mini-rpc';
import { MessageTransport } from '@dcl/mini-rpc';

import type { IRenderer } from '../types';
import { RendererHost } from './host';
import { serveRendererHost } from './rpc-transport';

/**
 * Bootstrap that runs *inside* a renderer iframe (Unity/Bevy/Babylon-in-iframe).
 *
 * The renderer document calls this once its engine is ready. It connects a
 * {@link MessageTransport} back to the parent inspector and serves a
 * {@link RendererHost} wrapping the engine's {@link IRenderer}. From here the
 * inspector's {@link RemoteRenderer} drives this host over RPC; the engine never
 * sees the boundary.
 *
 * The `createRenderer` factory builds the concrete engine adapter (e.g. a
 * BabylonRenderer in an iframe, or a Unity/Bevy IRenderer wrapper). Keeping it a
 * factory lets every out-of-process renderer reuse the identical handshake.
 */
export interface RendererIframeOptions {
  /**
   * Allowed parent origin for the postMessage channel. Defaults to '*' only
   * when unset; callers should pass the inspector origin in production.
   */
  parentOrigin?: string;
  /** Build the engine-side IRenderer (constructed once the engine is ready). */
  createRenderer: () => IRenderer;
  /** Override the parent window (tests). Defaults to window.parent. */
  parentWindow?: Window;
  /** Override the local window (tests). Defaults to window. */
  selfWindow?: Window;
  /**
   * Provide the mini-rpc transport directly instead of building a
   * MessageTransport from windows (tests inject an in-memory transport).
   */
  transport?: Transport;
}

export interface RendererIframeHandle {
  host: RendererHost;
  renderer: IRenderer;
  dispose(): void;
}

export function startRendererIframe(options: RendererIframeOptions): RendererIframeHandle {
  const transport: Transport =
    options.transport ??
    new MessageTransport(
      options.selfWindow ?? window,
      options.parentWindow ?? window.parent,
      options.parentOrigin ?? '*',
    );

  const renderer = options.createRenderer();
  const served = serveRendererHost(
    transport,
    emitOutbound => new RendererHost(renderer, emitOutbound),
  );

  // Push initial state so the inspector mirror is populated immediately on
  // connect, then let the host's own change/frame subscriptions keep it fresh.
  served.host.pushState();

  return {
    host: served.host,
    renderer,
    dispose() {
      served.dispose();
      renderer.dispose();
    },
  };
}
