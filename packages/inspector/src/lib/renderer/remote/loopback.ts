import type { IRenderer } from '../types';
import { RendererHost } from './host';
import type {
  RendererCommand,
  RendererOutbound,
  RendererRequest,
  RendererRequestResult,
  RendererTransport,
} from './protocol';
import { RemoteRenderer } from './RemoteRenderer';

/**
 * Force a payload through a JSON round-trip, exactly as a real postMessage /
 * structured-clone boundary would. If anything non-serializable (a Babylon
 * object, a class instance, a function) leaked into the protocol, this throws
 * or silently drops it — which is precisely what we want the loopback to expose
 * before a real worker is ever involved.
 */
function wire<T>(value: T): T {
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
export function createLoopback(target: IRenderer): {
  remote: RemoteRenderer;
  host: RendererHost;
  dispose(): void;
} {
  let outboundHandler: ((message: RendererOutbound) => void) | null = null;

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
    dispose() {
      outboundHandler = null;
    },
  };

  const remote = new RemoteRenderer(transport);

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
