import type { Transport } from '@dcl/mini-rpc';
import { RPC } from '@dcl/mini-rpc';

import type { RendererHost } from './host';
import type {
  InspectorRequest,
  InspectorRequestResult,
  RendererCommand,
  RendererOutbound,
  RendererRequest,
  RendererRequestResult,
  RendererTransport,
} from './protocol';

/**
 * A {@link RendererTransport} over `@dcl/mini-rpc`, i.e. real cross-context RPC
 * (Worker / iframe via `MessageTransport`). This is what the in-process
 * {@link createLoopback} stands in for during tests — swapping one for the
 * other is purely a transport change; the host, the mirror ({@link
 * RemoteRenderer}), and every consumer are identical.
 *
 * Wire mapping onto mini-rpc:
 *  - Commands (inspector → renderer): fire-and-forget RPC **events** (`command`).
 *    Commands don't need a response, and events avoid a per-command await.
 *  - Requests (inspector → renderer, awaited): RPC **methods** (`request`).
 *  - Outbound (renderer → inspector): RPC **events** (`outbound`), carrying both
 *    the reverse-channel events and the snapshot pushes.
 *
 * Both sides share one channel name so their RPC instances pair up over the
 * underlying transport, exactly like the existing scene/scene-metrics RPCs.
 */

const CHANNEL = 'renderer-boundary';

enum Method {
  /** Inspector → renderer (e.g. getPointerWorldPoint). */
  REQUEST = 'request',
  /** Renderer → inspector (asset loading). */
  INSPECT_REQUEST = 'inspect_request',
}

type Params = {
  [Method.REQUEST]: RendererRequest;
  [Method.INSPECT_REQUEST]: InspectorRequest;
};

type Result = {
  // The union of possible results; narrowed by the caller per request.
  [Method.REQUEST]: RendererRequestResult[RendererRequest['kind']];
  [Method.INSPECT_REQUEST]: InspectorRequestResult[InspectorRequest['kind']];
};

enum EventType {
  COMMAND = 'command',
  OUTBOUND = 'outbound',
}

type EventData = {
  [EventType.COMMAND]: RendererCommand;
  [EventType.OUTBOUND]: RendererOutbound;
};

type RendererRPC = RPC<Method, Params, Result, EventType, EventData>;

/**
 * Default ceiling for an awaited request. mini-rpc never times out or rejects
 * outstanding requests on its own, so without this a request to a peer that
 * crashed/navigated would hang forever (wedging the awaiting flow).
 */
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Tracks in-flight requests so they can be (a) timed out and (b) rejected on
 * dispose — mini-rpc does neither. Used by both directions (inspector→renderer
 * and renderer→inspector) so neither can hang a caller forever.
 */
function createRequestTracker(timeoutMs: number) {
  const inFlight = new Set<(reason: Error) => void>();
  let disposed = false;

  return {
    run<T>(label: string, send: () => Promise<unknown>): Promise<T> {
      if (disposed) return Promise.reject(new Error('renderer transport disposed'));
      return new Promise<T>((resolve, reject) => {
        let settled = false;
        const done = (fn: () => void) => {
          if (settled) return;
          settled = true;
          inFlight.delete(reject);
          clearTimeout(timer);
          fn();
        };
        const timer = setTimeout(
          () => done(() => reject(new Error(`renderer request "${label}" timed out`))),
          timeoutMs,
        );
        inFlight.add(reject);
        send()
          .then(result => done(() => resolve(result as T)))
          .catch(error => done(() => reject(error)));
      });
    },
    dispose() {
      disposed = true;
      const rejecters = [...inFlight];
      inFlight.clear();
      rejecters.forEach(r => r(new Error('renderer transport disposed')));
    },
  };
}

/**
 * Inspector side: the {@link RendererTransport} the {@link RemoteRenderer}
 * drives. Construct with a mini-rpc `Transport` to the renderer context.
 */
export function createRpcRendererTransport(
  transport: Transport,
  options: { requestTimeoutMs?: number } = {},
): RendererTransport {
  const rpc: RendererRPC = new RPC(CHANNEL, transport);
  const timeoutMs = options.requestTimeoutMs ?? REQUEST_TIMEOUT_MS;
  const tracker = createRequestTracker(timeoutMs);

  // The currently-active inspector-request handler (asset loading). Identity is
  // tracked so a stale teardown can't clobber a newer handler on a reused channel.
  let activeInspectRequestHandler:
    | (<K extends InspectorRequest['kind']>(
        request: Extract<InspectorRequest, { kind: K }>,
      ) => Promise<InspectorRequestResult[K]>)
    | null = null;

  return {
    sendCommand(command: RendererCommand) {
      rpc.emit(EventType.COMMAND, command);
    },
    request<K extends RendererRequest['kind']>(
      request: Extract<RendererRequest, { kind: K }>,
    ): Promise<RendererRequestResult[K]> {
      return tracker.run<RendererRequestResult[K]>(request.kind, () =>
        rpc.request(Method.REQUEST, request),
      );
    },
    onOutbound(handler: (message: RendererOutbound) => void) {
      const listener = (message: RendererOutbound) => handler(message);
      rpc.on(EventType.OUTBOUND, listener);
      return () => rpc.off(EventType.OUTBOUND, listener);
    },
    onRequest(handler) {
      // Track this handler's identity so a later teardown only resets if it's
      // still the active one (a second RemoteRenderer may have re-registered).
      const active = handler;
      rpc.handle(Method.INSPECT_REQUEST, request =>
        activeInspectRequestHandler === active
          ? handler(request as never)
          : Promise.resolve(null as never),
      );
      activeInspectRequestHandler = active;
      return () => {
        if (activeInspectRequestHandler === active) activeInspectRequestHandler = null;
      };
    },
    dispose() {
      tracker.dispose();
      rpc.dispose();
    },
  };
}

/**
 * Renderer side: binds a {@link RendererHost} to a mini-rpc `Transport`. The
 * host emits outbound messages (events + snapshots) which we forward, and we
 * route inbound commands/requests into the host.
 *
 * `createHost` receives a `requestInspector` so the renderer can ask the
 * inspector for assets (the reverse request direction) — an out-of-process
 * renderer's only route to file bytes.
 */
export function serveRendererHost(
  transport: Transport,
  createHost: (
    emitOutbound: (message: RendererOutbound) => void,
    requestInspector: <K extends InspectorRequest['kind']>(
      request: Extract<InspectorRequest, { kind: K }>,
    ) => Promise<InspectorRequestResult[K]>,
  ) => RendererHost,
): { host: RendererHost; dispose(): void } {
  const rpc: RendererRPC = new RPC(CHANNEL, transport);
  const tracker = createRequestTracker(REQUEST_TIMEOUT_MS);

  const requestInspector = <K extends InspectorRequest['kind']>(
    request: Extract<InspectorRequest, { kind: K }>,
  ): Promise<InspectorRequestResult[K]> =>
    tracker.run<InspectorRequestResult[K]>(request.kind, () =>
      rpc.request(Method.INSPECT_REQUEST, request),
    );

  const host = createHost(message => rpc.emit(EventType.OUTBOUND, message), requestInspector);

  rpc.on(EventType.COMMAND, command => host.handleCommand(command));
  rpc.handle(Method.REQUEST, request => host.handleRequest(request as never));

  return {
    host,
    dispose() {
      tracker.dispose();
      host.dispose();
      rpc.dispose();
    },
  };
}
