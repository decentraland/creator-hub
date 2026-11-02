import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthenticatedMessageTransport } from './transport';

const ORIGIN = 'http://localhost:4321';
const MESSAGE = { id: '1', type: 'request', payload: {} };

/**
 * Stand-in for the inspector iframe. `contentWindow` is writable so a test can replace it the
 * way a real navigation does — the property the production bug turned on.
 */
function fakeIframe(src: string) {
  const iframe = { src, contentWindow: null as Window | null };
  return iframe as unknown as HTMLIFrameElement & { contentWindow: Window | null };
}

function fakeWindow() {
  return { postMessage: vi.fn() } as unknown as Window & { postMessage: ReturnType<typeof vi.fn> };
}

describe('AuthenticatedMessageTransport', () => {
  let iframe: ReturnType<typeof fakeIframe>;
  let peer: ReturnType<typeof fakeWindow>;
  let transport: AuthenticatedMessageTransport;
  let received: unknown[];

  const deliver = (data: unknown, from: unknown, origin: string) => {
    const event = new MessageEvent('message', { data, origin });
    // happy-dom does not let `source` be set through the constructor.
    Object.defineProperty(event, 'source', { value: from });
    window.dispatchEvent(event);
  };

  beforeEach(() => {
    received = [];
    iframe = fakeIframe(`${ORIGIN}/?projectId=1`);
    peer = fakeWindow();
    iframe.contentWindow = peer;
    transport = new AuthenticatedMessageTransport(iframe);
    transport.addEventListener('message', message => received.push(message));
  });

  // Each transport attaches to `window`, so one left behind would keep delivering into the
  // next test's `received`. Disposing twice is a no-op, so the dispose case below is fine.
  afterEach(() => transport.dispose());

  describe('when a message arrives from the expected frame and origin', () => {
    it('should deliver it', () => {
      deliver(MESSAGE, peer, ORIGIN);

      expect(received).toEqual([MESSAGE]);
    });
  });

  describe('when a message arrives from a different window', () => {
    it('should drop it', () => {
      deliver(MESSAGE, fakeWindow(), ORIGIN);

      expect(received).toEqual([]);
    });
  });

  describe('when a message arrives from a different origin', () => {
    it('should drop it', () => {
      deliver(MESSAGE, peer, 'https://other.example');

      expect(received).toEqual([]);
    });
  });

  describe('when the frame navigates and replaces its window', () => {
    // The transport must follow the element, not the window it happened to host when it was
    // constructed. Capturing the window instead left every reply from the new document
    // unmatched, so each call timed out.
    it('should deliver from the new window', () => {
      const replacement = fakeWindow();
      iframe.contentWindow = replacement;

      deliver(MESSAGE, replacement, ORIGIN);

      expect(received).toEqual([MESSAGE]);
    });

    it('should no longer deliver from the window it replaced', () => {
      iframe.contentWindow = fakeWindow();

      deliver(MESSAGE, peer, ORIGIN);

      expect(received).toEqual([]);
    });

    it('should send to the new window', () => {
      const replacement = fakeWindow();
      iframe.contentWindow = replacement;

      transport.send(MESSAGE);

      expect(replacement.postMessage).toHaveBeenCalledWith(MESSAGE, ORIGIN);
      expect(peer.postMessage).not.toHaveBeenCalled();
    });
  });

  describe('when the frame has no window yet', () => {
    it('should drop inbound messages rather than throwing', () => {
      iframe.contentWindow = null;

      expect(() => deliver(MESSAGE, peer, ORIGIN)).not.toThrow();
      expect(received).toEqual([]);
    });
  });

  describe('when sending a message', () => {
    it('should target the expected origin rather than a wildcard', () => {
      transport.send(MESSAGE);

      expect(peer.postMessage).toHaveBeenCalledWith(MESSAGE, ORIGIN);
    });
  });

  describe('when disposed', () => {
    it('should stop delivering messages', () => {
      transport.dispose();

      deliver(MESSAGE, peer, ORIGIN);

      expect(received).toEqual([]);
    });
  });
});
