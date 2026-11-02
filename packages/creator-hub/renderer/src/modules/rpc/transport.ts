import { Transport, type Message } from '@dcl/mini-rpc';

/**
 * The origin the iframe is currently pointed at, or null if `src` is not a usable URL.
 *
 * Read from `src` rather than rebuilt from the inspector port: `EditorPage` honours
 * `VITE_INSPECTOR_PORT`, so the two differ in development, and this keeps working if the
 * inspector is ever served from somewhere other than localhost.
 */
function originOf(iframe: HTMLIFrameElement): string | null {
  try {
    return new URL(iframe.src).origin;
  } catch {
    return null;
  }
}

/**
 * A `postMessage` transport bound to one iframe.
 *
 * `@dcl/mini-rpc`'s `MessageTransport` uses its `origin` argument only as the `postMessage`
 * targetOrigin, and delivers every inbound `message` event whatever its source — channel ids
 * separate the RPC pairs by naming convention, not by checking who sent the frame.
 *
 * Both directions are pinned here: an inbound event is delivered only when it comes from the
 * iframe's current window *and* its origin, and outbound messages name that origin rather
 * than `'*'`.
 *
 * The iframe element is held rather than its `contentWindow`, and both the window and the
 * origin are read per message. An element outlives the documents it hosts, so a window
 * captured at construction stops matching as soon as the frame navigates — and every reply
 * would then be dropped, leaving each RPC call to time out with nothing logged.
 */
export class AuthenticatedMessageTransport extends Transport {
  private handler = (event: MessageEvent) => {
    if (!event.data) return;

    const peer = this.iframe.contentWindow;
    if (!peer || event.source !== peer) return;

    const origin = originOf(this.iframe);
    if (event.origin !== origin) {
      // Reached only by the frame this transport is bound to, so it should never fire.
      // Logged because the alternative is a silent drop that surfaces as a timeout.
      console.warn(
        `[rpc] dropped a message from the inspector frame: origin "${event.origin}" does not match "${origin}"`,
      );
      return;
    }

    this.emit('message', event.data);
  };

  constructor(private readonly iframe: HTMLIFrameElement) {
    super();
    window.addEventListener('message', this.handler);
  }

  send(message: Message) {
    const peer = this.iframe.contentWindow;
    const origin = originOf(this.iframe);
    if (!peer || origin === null) {
      console.warn('[rpc] cannot send to the inspector frame: no window or unusable src');
      return;
    }
    peer.postMessage(message, origin);
  }

  dispose() {
    window.removeEventListener('message', this.handler);
  }
}
