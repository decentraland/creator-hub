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
 * real worker is involved. Falls back to JSON where structuredClone is absent.
 */
function wire<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
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

  const host = new RendererHost(target, message => {
    // Renderer → inspector, across the "wire".
    outboundHandler?.(wire(message));
  });

  const transport: RendererTransport = {
    sendCommand(command: RendererCommand) {
      host.handleCommand(wire(command));
    },
    async request<K extends RendererRequest['kind']>(
      request: Extract<RendererRequest, { kind: K }>,
    ): Promise<RendererRequestResult[K]> {
      const result = await host.handleRequest(wire(request));
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
      if (!inspectorRequestHandler) return null as InspectorRequestResult[K];
      const result = await inspectorRequestHandler(wire(request));
      return wire(result);
    },
    dispose() {
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
      remote.dispose();
      host.dispose();
    },
  };
}
