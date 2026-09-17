import { afterEach, describe, expect, it, vi } from 'vitest';

import { request, resolveUrl } from '../src/modules/metrics';

const BASE = 'https://creators-data.decentraland.zone/v1';

describe('resolveUrl', () => {
  describe('when joining the base with a path', () => {
    it('should keep the base path segment', () => {
      expect(resolveUrl({ baseUrl: BASE, path: '/metrics' }).toString()).toBe(
        'https://creators-data.decentraland.zone/v1/metrics',
      );
    });

    it('should not care whether the parts carry slashes', () => {
      const withSlashes = resolveUrl({ baseUrl: `${BASE}/`, path: '/metrics' }).toString();
      const withoutSlashes = resolveUrl({ baseUrl: BASE, path: 'metrics' }).toString();
      expect(withSlashes).toBe(withoutSlashes);
    });
  });

  describe('when the host is a Decentraland one', () => {
    it.each([
      'https://creators-data.decentraland.org/v1',
      'https://creators-data.decentraland.zone/v1',
      'https://creators-data.decentraland.today/v1',
    ])('should allow %s', baseUrl => {
      expect(() => resolveUrl({ baseUrl, path: '/metrics' })).not.toThrow();
    });
  });

  describe('when the service runs locally', () => {
    it('should allow plain http on localhost', () => {
      expect(() =>
        resolveUrl({ baseUrl: 'http://localhost:8787/v1', path: '/metrics' }),
      ).not.toThrow();
      expect(() =>
        resolveUrl({ baseUrl: 'http://127.0.0.1:8787/v1', path: '/metrics' }),
      ).not.toThrow();
    });
  });

  describe('when the host is not a Decentraland one', () => {
    it('should refuse it, so main is not a general-purpose fetch proxy', () => {
      expect(() =>
        resolveUrl({ baseUrl: 'https://evil.example.com/v1', path: '/metrics' }),
      ).toThrow(/host is not allowed/);
    });

    it('should refuse a lookalike domain', () => {
      expect(() =>
        resolveUrl({ baseUrl: 'https://decentraland.org.evil.com/v1', path: '/metrics' }),
      ).toThrow(/host is not allowed/);
    });

    it('should refuse plain http off localhost', () => {
      expect(() =>
        resolveUrl({ baseUrl: 'http://creators-data.decentraland.zone/v1', path: '/metrics' }),
      ).toThrow(/must be https/);
    });
  });
});

describe('request', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Captures what `request` handed to fetch, answering with the given response. */
  function stubFetch(response: Partial<Response> & { text: () => Promise<string> }) {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200, ...response });
    vi.stubGlobal('fetch', fetchSpy);
    return fetchSpy;
  }

  const body = { locations: [{ world: 'example-name.dcl.eth', x: 0, y: 0 }] };

  describe('when sending a body', () => {
    it('should POST it as JSON', async () => {
      const fetchSpy = stubFetch({ text: () => Promise.resolve('{"locations":[]}') });

      await request({ baseUrl: BASE, path: '/metrics', body });

      const [, init] = fetchSpy.mock.calls[0];
      expect(init.method).toBe('POST');
      expect(init.body).toBe(JSON.stringify(body));
      expect(init.headers['content-type']).toBe('application/json');
    });

    it('should pass the caller signed headers through untouched', async () => {
      const fetchSpy = stubFetch({ text: () => Promise.resolve('{}') });

      await request({
        baseUrl: BASE,
        path: '/metrics',
        body,
        headers: { 'x-identity-auth-chain-0': '{"type":"SIGNER"}' },
      });

      const [, init] = fetchSpy.mock.calls[0];
      expect(init.headers['x-identity-auth-chain-0']).toBe('{"type":"SIGNER"}');
    });

    it('should parse the response', async () => {
      stubFetch({ text: () => Promise.resolve('{"exported_at":"2026-08-12T00:17:01.099Z"}') });

      const response = await request({ baseUrl: BASE, path: '/metrics', body });

      expect(response).toEqual({
        ok: true,
        status: 200,
        data: { exported_at: '2026-08-12T00:17:01.099Z' },
      });
    });
  });

  describe('when the service rejects the request', () => {
    it('should surface a 400 that names the offending entry', async () => {
      const message = 'locations[0]: "Not A Name" is not a valid ENS name';
      stubFetch({
        ok: false,
        status: 400,
        // The real shape: `error` is the generic status, `message` the detail.
        text: () => Promise.resolve(JSON.stringify({ error: 'Bad request', message })),
      });

      expect(await request({ baseUrl: BASE, path: '/metrics', body })).toEqual({
        ok: false,
        status: 400,
        error: message,
      });
    });

    it('should keep the detail rather than the generic status beside it', async () => {
      stubFetch({
        ok: false,
        status: 400,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              error: 'Bad request',
              message: 'too many locations: 101 given, at most 100 per request',
            }),
          ),
      });

      const response = await request({ baseUrl: BASE, path: '/metrics', body });

      expect(response.ok).toBe(false);
      if (response.ok) return;
      expect(response.error).toMatch(/at most 100 per request/);
      expect(response.error).not.toBe('Bad request');
    });

    it('should fall back to the generic status when there is no detail', async () => {
      stubFetch({
        ok: false,
        status: 401,
        text: () => Promise.resolve(JSON.stringify({ error: 'Not Authorized' })),
      });

      expect(await request({ baseUrl: BASE, path: '/metrics', body })).toMatchObject({
        error: 'Not Authorized',
      });
    });

    it('should fall back to the raw body when the error is not JSON', async () => {
      stubFetch({ ok: false, status: 403, text: () => Promise.resolve('Forbidden') });

      expect(await request({ baseUrl: BASE, path: '/metrics', body })).toMatchObject({
        status: 403,
        error: 'Forbidden',
      });
    });

    it('should report a 401 rather than throwing, so the UI can render it', async () => {
      stubFetch({ ok: false, status: 401, text: () => Promise.resolve('') });

      const response = await request({ baseUrl: BASE, path: '/metrics', body });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
    });
  });

  describe('when the host is not allowed', () => {
    it('should fail as a value without reaching the network', async () => {
      const fetchSpy = stubFetch({ text: () => Promise.resolve('{}') });

      expect(
        await request({ baseUrl: 'https://evil.example.com/v1', path: '/metrics', body }),
      ).toMatchObject({ ok: false, status: 0 });
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});
