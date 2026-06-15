import type { IRenderer } from '../types';
import { RendererHost } from './host';
import type {
  AssetProvider,
  InspectorRequest,
  InspectorRequestResult,
  RendererCommand,
  RendererOutbound,
  RendererRequest,
  RendererRequestResult,
  RendererTransport,
} from './protocol';
import { RemoteRenderer } from './RemoteRenderer';

/**
 * Force a payload through a clone, exactly as a postMessage / structured-clone
 * boundary would. structuredClone matches postMessage semantics faithfully —
 * it preserves Uint8Array (asset bytes), Map, etc., while still throwing on a
 * genuinely non-cloneable value (a function, a class instance, a Babylon
 * object) — which is precisely what we want the loopback to expose before a
 * real worker is involved. If structuredClone is unavailable we throw rather
 * than fall back to JSON (which would silently corrupt Uint8Array).
 */
function wire<T>(value: T): T {
  // structuredClone faithfully preserves Uint8Array (asset bytes), Map, etc.,
  // matching a real postMessage boundary. A JSON fallback would silently corrupt
  // Uint8Array into a plain object — so fail loudly instead. structuredClone is
  // available in all environments this runs in (Node 17+, all modern browsers).
  if (typeof structuredClone !== 'function') {
    throw new Error('renderer loopback requires structuredClone (Node 17+/modern browser)');
  }
  return structuredClone(value);
}

/**
 * An in-process {@link RendererTransport} that connects an inspector-side
 * {@link RemoteRenderer} to a renderer-side {@link RendererHost} wrapping a real
 * {@link IRenderer}. Every message crosses a JSON round-trip, so this proves the
 * state-mirror + RPC architecture end-to-end without standing up a Worker.
 *
 * Swapping this for a mini-rpc-over-postMessage transport is then purely a
 * transport change — the host, the mirror, and all consumers stay identical.
 */
export function createLoopback(
  target: IRenderer,
  assets?: AssetProvider,
): {
  remote: RemoteRenderer;
  host: RendererHost;
  dispose(): void;
} {
  let outboundHandler: ((message: RendererOutbound) => void) | null = null;
  let inspectorRequestHandler:
    | (<K extends InspectorRequest['kind']>(
        request: Extract<InspectorRequest, { kind: K }>,
      ) => Promise<InspectorRequestResult[K]>)
    | null = null;
  let disposed = false;

  const host = new RendererHost(target, message => {
    // Renderer → inspector, across the "wire".
    if (!disposed) outboundHandler?.(wire(message));
  });

  const transport: RendererTransport = {
    sendCommand(command: RendererCommand) {
      if (disposed) return;
      host.handleCommand(wire(command));
    },
    async request<K extends RendererRequest['kind']>(
      request: Extract<RendererRequest, { kind: K }>,
    ): Promise<RendererRequestResult[K]> {
      if (disposed) throw new Error('renderer transport disposed');
      const result = await host.handleRequest(wire(request));
      if (disposed) throw new Error('renderer transport disposed');
      return wire(result);
    },
    onOutbound(handler) {
      outboundHandler = handler;
      return () => {
        if (outboundHandler === handler) outboundHandler = null;
      };
    },
    onRequest(handler) {
      inspectorRequestHandler = handler;
      return () => {
        if (inspectorRequestHandler === handler) inspectorRequestHandler = null;
      };
    },
    async requestInspector<K extends InspectorRequest['kind']>(
      request: Extract<InspectorRequest, { kind: K }>,
    ): Promise<InspectorRequestResult[K]> {
      if (disposed || !inspectorRequestHandler) {
        if (disposed) throw new Error('renderer transport disposed');
        return null as InspectorRequestResult[K];
      }
      const result = await inspectorRequestHandler(wire(request));
      return wire(result);
    },
    dispose() {
      disposed = true;
      outboundHandler = null;
      inspectorRequestHandler = null;
    },
  };

  const remote = new RemoteRenderer(transport, assets);

  // Prime the mirror with the current state so sync reads work immediately.
  host.pushState();

  return {
    remote,
    host,
    dispose() {
      transport.dispose();
      remote.dispose();
      host.dispose();
    },
  };
}
