import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthenticatedMessageTransport } from './transport';

const ORIGIN = 'http://localhost:4321';

describe('AuthenticatedMessageTransport', () => {
  let peer: Window;
  let postMessage: ReturnType<typeof vi.fn>;
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
    postMessage = vi.fn();
    peer = { postMessage } as unknown as Window;
    transport = new AuthenticatedMessageTransport(peer, ORIGIN);
    transport.addEventListener('message', message => received.push(message));
  });

  // Each transport attaches to `window`, so one left behind would keep delivering into the
  // next test's `received`. Disposing twice is a no-op, so the dispose case below is fine.
  afterEach(() => transport.dispose());

  describe('when a message arrives from the expected peer and origin', () => {
    it('should deliver it', () => {
      deliver({ id: '1', type: 'request', payload: {} }, peer, ORIGIN);

      expect(received).toEqual([{ id: '1', type: 'request', payload: {} }]);
    });
  });

  describe('when a message arrives from a different window', () => {
    it('should drop it', () => {
      const otherWindow = { postMessage: vi.fn() } as unknown as Window;

      deliver({ id: '1', type: 'request', payload: {} }, otherWindow, ORIGIN);

      expect(received).toEqual([]);
    });
  });

  describe('when a message arrives from a different origin', () => {
    it('should drop it', () => {
      deliver({ id: '1', type: 'request', payload: {} }, peer, 'https://other.example');

      expect(received).toEqual([]);
    });
  });

  describe('when sending a message', () => {
    it('should target the expected origin rather than a wildcard', () => {
      transport.send({ id: '1', type: 'request', payload: {} });

      expect(postMessage).toHaveBeenCalledWith({ id: '1', type: 'request', payload: {} }, ORIGIN);
    });
  });

  describe('when disposed', () => {
    it('should stop delivering messages', () => {
      transport.dispose();

      deliver({ id: '1', type: 'request', payload: {} }, peer, ORIGIN);

      expect(received).toEqual([]);
    });
  });
});
