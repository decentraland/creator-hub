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
 * Inspector side: the {@link RendererTransport} the {@link RemoteRenderer}
 * drives. Construct with a mini-rpc `Transport` to the renderer context.
 */
export function createRpcRendererTransport(transport: Transport): RendererTransport {
  const rpc: RendererRPC = new RPC(CHANNEL, transport);

  return {
    sendCommand(command: RendererCommand) {
      rpc.emit(EventType.COMMAND, command);
    },
    async request<K extends RendererRequest['kind']>(
      request: Extract<RendererRequest, { kind: K }>,
    ): Promise<RendererRequestResult[K]> {
      const result = await rpc.request(Method.REQUEST, request);
      return result as RendererRequestResult[K];
    },
    onOutbound(handler: (message: RendererOutbound) => void) {
      const listener = (message: RendererOutbound) => handler(message);
      rpc.on(EventType.OUTBOUND, listener);
      return () => rpc.off(EventType.OUTBOUND, listener);
    },
    onRequest(handler) {
      rpc.handle(Method.INSPECT_REQUEST, request => handler(request as never));
      // mini-rpc has no unhandle; replace with a no-op resolver on teardown.
      return () => rpc.handle(Method.INSPECT_REQUEST, async () => null as never);
    },
    dispose() {
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

  const requestInspector = async <K extends InspectorRequest['kind']>(
    request: Extract<InspectorRequest, { kind: K }>,
  ): Promise<InspectorRequestResult[K]> => {
    const result = await rpc.request(Method.INSPECT_REQUEST, request);
    return result as InspectorRequestResult[K];
  };

  const host = createHost(message => rpc.emit(EventType.OUTBOUND, message), requestInspector);

  rpc.on(EventType.COMMAND, command => host.handleCommand(command));
  rpc.handle(Method.REQUEST, request => host.handleRequest(request as never));

  return {
    host,
    dispose() {
      host.dispose();
      rpc.dispose();
    },
  };
}
