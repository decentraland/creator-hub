// @vitest-environment node
// Runs against Node's own fetch and a real local server: happy-dom's fetch does not reject
// with the abort reason the way the platform's does.
import http from 'http';
import type { AddressInfo } from 'net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { fetch, isFetchError } from '../fetch';

const TIMEOUT_MS = 50;

describe('fetch', () => {
  let server: http.Server;
  let url: string;
  let response: Response | undefined;
  let error: unknown;

  const listen = async (handler: http.RequestListener) => {
    server = http.createServer(handler);
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  };

  const run = async () => {
    try {
      response = await fetch(url, undefined, TIMEOUT_MS);
    } catch (e) {
      error = e;
    }
  };

  beforeEach(() => {
    response = undefined;
    error = undefined;
  });

  afterEach(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });

  describe('when the server does not answer in time', () => {
    beforeEach(async () => {
      await listen(() => undefined);
      await run();
    });

    it('should throw a request timeout error', () => {
      expect(isFetchError(error, 'REQUEST_TIMEOUT')).toBe(true);
    });
  });

  describe('when the server answers in time', () => {
    beforeEach(async () => {
      await listen((_req, res) => res.end('ok'));
      await run();
    });

    it('should resolve with the response', async () => {
      expect(await response?.text()).toBe('ok');
    });
  });

  describe('when the server drops the connection', () => {
    beforeEach(async () => {
      await listen(req => req.socket.destroy());
      await run();
    });

    it('should throw the network error rather than a timeout', () => {
      expect(error).toBeInstanceOf(TypeError);
      expect(isFetchError(error, '*')).toBe(false);
    });
  });
});
