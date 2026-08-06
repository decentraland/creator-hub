import { describe, expect, it } from 'vitest';

import { resolveUrl } from '../src/modules/metrics';

const BASE = 'https://creators-data.decentraland.zone/api';

describe('resolveUrl', () => {
  describe('when joining the base with a path', () => {
    it('should keep the base path segment', () => {
      expect(resolveUrl({ baseUrl: BASE, path: '/me' }).toString()).toBe(
        'https://creators-data.decentraland.zone/api/me',
      );
    });

    it('should not care whether the parts carry slashes', () => {
      const withSlashes = resolveUrl({ baseUrl: `${BASE}/`, path: '/me' }).toString();
      const withoutSlashes = resolveUrl({ baseUrl: BASE, path: 'me' }).toString();
      expect(withSlashes).toBe(withoutSlashes);
    });

    it('should encode a world name into the path', () => {
      expect(resolveUrl({ baseUrl: BASE, path: '/worlds/my-world.dcl.eth/metrics' }).pathname).toBe(
        '/api/worlds/my-world.dcl.eth/metrics',
      );
    });
  });

  describe('when the host is a Decentraland one', () => {
    it.each([
      'https://creators-data.decentraland.org/api',
      'https://creators-data.decentraland.zone/api',
      'https://creators-data.decentraland.today/api',
    ])('should allow %s', baseUrl => {
      expect(() => resolveUrl({ baseUrl, path: '/me' })).not.toThrow();
    });
  });

  describe('when the service runs locally', () => {
    it('should allow plain http on localhost', () => {
      expect(() => resolveUrl({ baseUrl: 'http://localhost:8787/api', path: '/me' })).not.toThrow();
      expect(() => resolveUrl({ baseUrl: 'http://127.0.0.1:8787/api', path: '/me' })).not.toThrow();
    });
  });

  describe('when the host is not a Decentraland one', () => {
    it('should refuse it, so main is not a general-purpose fetch proxy', () => {
      expect(() => resolveUrl({ baseUrl: 'https://evil.example.com/api', path: '/me' })).toThrow(
        /host is not allowed/,
      );
    });

    it('should refuse a lookalike domain', () => {
      expect(() =>
        resolveUrl({ baseUrl: 'https://decentraland.org.evil.com/api', path: '/me' }),
      ).toThrow(/host is not allowed/);
    });

    it('should refuse plain http off localhost', () => {
      expect(() =>
        resolveUrl({ baseUrl: 'http://creators-data.decentraland.zone/api', path: '/me' }),
      ).toThrow(/must be https/);
    });
  });
});
