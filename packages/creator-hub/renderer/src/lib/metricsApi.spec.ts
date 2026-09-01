import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildMetricsUrl } from '../../../shared/urls';

const BASE = 'http://localhost:8787/v1';
const ADDRESS = '0xdeadbeef';

/** Captures what the signer was asked to sign, without needing real crypto. */
const signedHeaders = vi.fn(() => new Headers({ 'x-identity-auth-chain-0': '{"type":"SIGNER"}' }));

vi.mock('decentraland-crypto-fetch', () => ({ signedHeaderFactory: () => signedHeaders }));
vi.mock('@dcl/single-sign-on-client', () => ({
  localStorageGetIdentity: vi.fn(() => ({ ephemeralIdentity: {}, authChain: [] })),
}));
vi.mock('/@/config', () => ({ config: { get: () => BASE } }));
vi.mock('./auth', () => ({ AuthServerProvider: { getAccount: vi.fn(() => ADDRESS) } }));

const { metrics } = await import('#preload');
const { MAX_LOCATIONS_PER_REQUEST, fetchMetrics } = await import('./metricsApi');

/** Answers each request with one entry per requested location, as the service does. */
function answerWith(
  build: (location: { world?: string; x: number; y: number }, index: number) => object = () => ({}),
) {
  vi.mocked(metrics.request).mockImplementation(async (request: any) => ({
    ok: true,
    status: 200,
    data: {
      exported_at: '2026-08-12T00:17:01.099Z',
      source: 'dcl_next.exports.export_creators_hub_scene_metrics',
      locations: request.body.locations.map((location: any, index: number) => ({
        location_key: 'do-not-read-me',
        builder_project_id: null,
        ...location,
        metrics: {},
        ...build(location, index),
      })),
    },
  }));
}

const requestBodies = () =>
  vi.mocked(metrics.request).mock.calls.map(([request]: any) => request.body);

describe('fetchMetrics', () => {
  beforeEach(() => {
    signedHeaders.mockClear();
    answerWith();
  });

  describe('when signing the request', () => {
    it('should sign the pathname that is actually requested', async () => {
      await fetchMetrics([{ world: 'example-name.dcl.eth', x: 0, y: 0 }]);

      const [, method, signedPath] = signedHeaders.mock.calls[0] as unknown as [
        unknown,
        string,
        string,
      ];
      const [[request]] = vi.mocked(metrics.request).mock.calls as any;

      expect(method).toBe('post');
      expect(signedPath).toBe(buildMetricsUrl(request.baseUrl, request.path).pathname);
      expect(signedPath).toBe('/v1/metrics');
    });

    it('should sign the bare pathname, with no query string and no body', async () => {
      const locations = [{ world: 'example-name.dcl.eth', x: 0, y: 0 }];
      await fetchMetrics(locations);

      const [, , signedPath, metadata] = signedHeaders.mock.calls[0] as unknown as [
        unknown,
        string,
        string,
        object,
      ];

      expect(signedPath).not.toContain('?');
      expect(signedPath).not.toContain('example-name');
      // The whole payload is method:path:timestamp:metadata — an empty metadata
      // keeps the body out of it entirely.
      expect(metadata).toEqual({});
      expect(JSON.stringify(metadata)).not.toContain('locations');
    });

    it('should send the signed headers with the request', async () => {
      await fetchMetrics([{ x: 20, y: 2 }]);

      const [[request]] = vi.mocked(metrics.request).mock.calls as any;
      expect(request.headers['x-identity-auth-chain-0']).toBe('{"type":"SIGNER"}');
    });

    it('should refuse to sign without a connected account', async () => {
      const { AuthServerProvider } = await import('./auth');
      vi.mocked(AuthServerProvider.getAccount).mockReturnValueOnce(undefined as any);

      await expect(fetchMetrics([{ x: 0, y: 0 }])).rejects.toThrow(/No connected account/);
    });
  });

  describe('when the request body is built', () => {
    it('should send a world with its coordinates, and a scene without one', async () => {
      await fetchMetrics([
        { world: 'example-name.dcl.eth', x: 0, y: 0 },
        { x: 20, y: 2 },
      ]);

      expect(requestBodies()[0]).toEqual({
        locations: [
          { world: 'example-name.dcl.eth', x: 0, y: 0 },
          { x: 20, y: 2 },
        ],
      });
    });
  });

  describe('when there are more locations than one request allows', () => {
    const many = Array.from({ length: MAX_LOCATIONS_PER_REQUEST + 1 }, (_, index) => ({
      x: index,
      y: 0,
    }));

    it('should split them into chunks of at most the maximum', async () => {
      await fetchMetrics(many);

      const bodies = requestBodies();
      expect(bodies).toHaveLength(2);
      expect(bodies[0].locations).toHaveLength(MAX_LOCATIONS_PER_REQUEST);
      expect(bodies[1].locations).toHaveLength(1);
    });

    it('should return one entry per requested location, in the order requested', async () => {
      const batch = await fetchMetrics(many);

      expect(batch.locations).toHaveLength(many.length);
      expect(batch.locations.map(location => location.x)).toEqual(many.map(location => location.x));
    });
  });

  describe('when the same location is requested twice', () => {
    it('should keep both entries rather than deduplicating', async () => {
      const duplicated = [
        { x: 5, y: 5 },
        { x: 5, y: 5 },
      ];

      const batch = await fetchMetrics(duplicated);

      expect(batch.locations).toHaveLength(2);
      expect(requestBodies()[0].locations).toEqual(duplicated);
    });
  });

  describe('when the response is read', () => {
    it('should read it positionally, ignoring location_key entirely', async () => {
      // Every entry claims to be somewhere else; only position may be trusted.
      answerWith(() => ({ location_key: 'somewhere|else', world: 'liar.dcl.eth', x: 999, y: 999 }));

      const batch = await fetchMetrics([
        { world: 'real.dcl.eth', x: 1, y: 2 },
        { x: 3, y: 4 },
      ]);

      expect(batch.locations[0]).toMatchObject({ world: 'real.dcl.eth', x: 1, y: 2 });
      expect(batch.locations[1]).toMatchObject({ x: 3, y: 4 });
      expect(batch.locations[1].world).toBeUndefined();
    });

    it('should keep the metrics and enrichment the service answered', async () => {
      answerWith((_location, index) => ({
        builder_project_id: index === 0 ? 'a-project-id' : null,
        metrics:
          index === 0 ? { unique_visitors_60d: [{ series: 'all', period: null, value: 188 }] } : {},
      }));

      const batch = await fetchMetrics([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ]);

      expect(batch.locations[0].metrics.unique_visitors_60d[0].value).toBe(188);
      expect(batch.locations[0].builder_project_id).toBe('a-project-id');
      expect(batch.locations[1].metrics).toEqual({});
    });

    it('should surface the export stamp even when every location is empty', async () => {
      const batch = await fetchMetrics([{ x: 0, y: 0 }]);

      expect(batch.exported_at).toBe('2026-08-12T00:17:01.099Z');
      expect(batch.locations[0].metrics).toEqual({});
    });

    it('should refuse a response that answers a different number of locations', async () => {
      vi.mocked(metrics.request).mockResolvedValue({
        ok: true,
        status: 200,
        data: { exported_at: 'x', source: 'y', locations: [] },
      } as any);

      await expect(fetchMetrics([{ x: 0, y: 0 }])).rejects.toThrow(/positional/i);
    });
  });

  describe('when the service rejects the request', () => {
    it('should throw with the message the service gave', async () => {
      vi.mocked(metrics.request).mockResolvedValue({
        ok: false,
        status: 400,
        error: 'locations[3]: "Not A Name" is not a valid ENS name',
      } as any);

      await expect(fetchMetrics([{ x: 0, y: 0 }])).rejects.toThrow(/is not a valid ENS name/);
    });
  });
});
