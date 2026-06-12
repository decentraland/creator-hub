import type { Transport } from '@dcl/mini-rpc';
import { RPC } from '@dcl/mini-rpc';

import type { RendererHost } from './host';
import type {
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
  REQUEST = 'request',
}

type Params = {
  [Method.REQUEST]: RendererRequest;
};

type Result = {
  // The union of possible request results; narrowed by the caller per request.
  [Method.REQUEST]: RendererRequestResult[RendererRequest['kind']];
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
    dispose() {
      rpc.dispose();
    },
  };
}

/**
 * Renderer side: binds a {@link RendererHost} to a mini-rpc `Transport`. The
 * host emits outbound messages (events + snapshots) which we forward, and we
 * route inbound commands/requests into the host.
 */
export function serveRendererHost(
  transport: Transport,
  createHost: (emitOutbound: (message: RendererOutbound) => void) => RendererHost,
): { host: RendererHost; dispose(): void } {
  const rpc: RendererRPC = new RPC(CHANNEL, transport);

  const host = createHost(message => rpc.emit(EventType.OUTBOUND, message));

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
