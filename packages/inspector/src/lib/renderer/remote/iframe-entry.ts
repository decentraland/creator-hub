import type { Transport } from '@dcl/mini-rpc';
import { MessageTransport } from '@dcl/mini-rpc';

import type { IRenderer } from '../types';
import { RendererHost } from './host';
import type { InspectorRequest, InspectorRequestResult } from './protocol';
import { serveRendererHost } from './rpc-transport';

/** Ask the inspector to fulfil a request (assets). Passed to the renderer factory. */
export type RequestInspector = <K extends InspectorRequest['kind']>(
  request: Extract<InspectorRequest, { kind: K }>,
) => Promise<InspectorRequestResult[K]>;

/** Load file bytes through the boundary — what an iframe renderer wires getFile to. */
export type RemoteAssetLoader = (src: string) => Promise<Uint8Array | null>;

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
   * Allowed parent origin for the postMessage channel. **Required** when this
   * builds a real `MessageTransport` (i.e. when `transport` is not injected):
   * the channel is fail-closed, so omitting it throws rather than defaulting to
   * the wildcard `'*'`, which would let any cross-origin window drive the host.
   * Pass `'*'` explicitly only if you genuinely intend an unrestricted channel.
   */
  parentOrigin?: string;
  /**
   * Build the engine-side IRenderer. Receives a `loadAsset` that fetches file
   * bytes from the inspector across the boundary — the engine wires its
   * file-loading (GLBs, textures) to it, since it cannot reach the inspector's
   * data layer directly.
   */
  createRenderer: (loadAsset: RemoteAssetLoader) => IRenderer;
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
  // We own (and must dispose) the transport only when we created it; an injected
  // transport (tests) is owned by the caller.
  let ownedTransport: MessageTransport | null = null;
  if (options.transport == null) {
    if (options.parentOrigin == null) {
      throw new Error(
        'startRendererIframe: parentOrigin is required (fail-closed). Pass the inspector ' +
          "origin, or '*' to explicitly opt into an unrestricted postMessage channel.",
      );
    }
    ownedTransport = new MessageTransport(
      options.selfWindow ?? window,
      options.parentWindow ?? window.parent,
      options.parentOrigin,
    );
  }
  const transport: Transport = options.transport ?? (ownedTransport as Transport);

  let renderer!: IRenderer;
  const served = serveRendererHost(transport, (emitOutbound, requestInspector) => {
    const loadAsset: RemoteAssetLoader = src => requestInspector({ kind: 'getFile', src });
    renderer = options.createRenderer(loadAsset);
    return new RendererHost(renderer, emitOutbound);
  });

  // Push initial state so the inspector mirror is populated immediately on
  // connect, then let the host's own change/frame subscriptions keep it fresh.
  served.host.pushState();

  return {
    host: served.host,
    renderer,
    dispose() {
      served.dispose();
      renderer.dispose();
      ownedTransport?.dispose();
    },
  };
}
