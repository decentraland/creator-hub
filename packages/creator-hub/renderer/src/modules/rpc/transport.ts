import { Transport, type Message } from '@dcl/mini-rpc';

/**
 * A `postMessage` transport bound to one peer window.
 *
 * `@dcl/mini-rpc`'s `MessageTransport` uses its `origin` argument only as the `postMessage`
 * targetOrigin, and delivers every inbound `message` event whatever its source — channel ids
 * separate the RPC pairs by naming convention, not by checking who sent the frame.
 *
 * Both directions are pinned here: an inbound event is delivered only when it comes from the
 * expected window *and* origin, and outbound messages name that origin rather than `'*'`.
 */
export class AuthenticatedMessageTransport extends Transport {
  private handler = (event: MessageEvent) => {
    if (event.source !== this.peer) return;
    if (event.origin !== this.origin) return;
    if (!event.data) return;
    this.emit('message', event.data);
  };

  constructor(
    private readonly peer: Window,
    private readonly origin: string,
  ) {
    super();
    window.addEventListener('message', this.handler);
  }

  send(message: Message) {
    this.peer.postMessage(message, this.origin);
  }

  dispose() {
    window.removeEventListener('message', this.handler);
  }
}

/**
 * The origin the Inspector iframe actually loaded from.
 *
 * Read from `iframe.src` rather than rebuilt from the inspector port: the iframe URL
 * honours `VITE_INSPECTOR_PORT`, so the two differ during local development, and this
 * keeps working if the Inspector is ever served from somewhere other than localhost.
 */
export function getIframeOrigin(iframe: HTMLIFrameElement) {
  return new URL(iframe.src).origin;
}
