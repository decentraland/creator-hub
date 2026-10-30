import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WorldLimits } from './worlds';

const WORLDS_SERVER = 'https://worlds-content-server.example.org';

const fetchMock = vi.fn();
const captureExceptionMock = vi.fn();

vi.mock('/@/config', () => ({
  config: { get: () => WORLDS_SERVER },
}));

vi.mock('@sentry/electron/renderer', () => ({
  captureException: (...args: unknown[]) => captureExceptionMock(...args),
}));

vi.mock('decentraland-crypto-fetch', () => ({
  default: (...args: unknown[]) => fetchMock(...args),
}));

const { Worlds } = await import('./worlds');

/** A promise that only settles by rejecting once the signal aborts, like a request to a hung server. */
function untilAborted(signal: AbortSignal) {
  return new Promise<never>((_, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason));
  });
}

describe('Worlds.fetchWorldLimits', () => {
  let controller: AbortController;
  let limits: WorldLimits | null;

  beforeEach(() => {
    fetchMock.mockReset();
    captureExceptionMock.mockReset();
    controller = new AbortController();
  });

  describe('when the server reports the limits', () => {
    beforeEach(async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ maxSceneSizeInBytes: '524288000', maxParcels: 100 }),
      });
      limits = await new Worlds().fetchWorldLimits(
        'my name.dcl.eth',
        ['0,0', '-1,2'],
        controller.signal,
      );
    });

    it('should ask for the encoded world with one parcels param per parcel, under the given signal', () => {
      expect(fetchMock).toHaveBeenCalledWith(
        `${WORLDS_SERVER}/world/my%20name.dcl.eth/limits?parcels=0%2C0&parcels=-1%2C2`,
        { signal: controller.signal },
      );
    });

    it('should return only the scene size limit, as a number of bytes', () => {
      expect(limits).toEqual({ maxSceneSizeInBytes: 524288000 });
    });
  });

  describe('when the server does not know the endpoint or the name', () => {
    let cancelBody: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      cancelBody = vi.fn().mockResolvedValue(undefined);
      fetchMock.mockResolvedValueOnce({ ok: false, status: 404, body: { cancel: cancelBody } });
      limits = await new Worlds().fetchWorldLimits('name.dcl.eth', ['0,0'], controller.signal);
    });

    it('should return null', () => {
      expect(limits).toBeNull();
    });

    it('should release the response body', () => {
      expect(cancelBody).toHaveBeenCalled();
    });

    it('should not report the response as an error', () => {
      expect(captureExceptionMock).not.toHaveBeenCalled();
    });
  });

  describe('when the server rejects the request with an unexpected status', () => {
    let cancelBody: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      cancelBody = vi.fn().mockResolvedValue(undefined);
      fetchMock.mockResolvedValueOnce({ ok: false, status: 400, body: { cancel: cancelBody } });
      limits = await new Worlds().fetchWorldLimits('name.dcl.eth', ['0,0'], controller.signal);
    });

    it('should return null', () => {
      expect(limits).toBeNull();
    });

    it('should release the response body', () => {
      expect(cancelBody).toHaveBeenCalled();
    });

    it('should report the status with the number of parcels, not the parcels', () => {
      expect(captureExceptionMock).toHaveBeenCalledWith(expect.any(Error), {
        tags: { source: 'worlds', event: 'fetch-world-limits' },
        extra: { worldName: 'name.dcl.eth', parcelCount: 1, status: 400 },
      });
    });
  });

  describe('when the scene size limit is not a decimal string', () => {
    beforeEach(async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ maxSceneSizeInBytes: 'unlimited', maxParcels: 100 }),
      });
      limits = await new Worlds().fetchWorldLimits('name.dcl.eth', ['0,0'], controller.signal);
    });

    it('should return null', () => {
      expect(limits).toBeNull();
    });

    it('should report the invalid response', () => {
      expect(captureExceptionMock).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          extra: expect.objectContaining({ maxSceneSizeInBytes: 'unlimited' }),
        }),
      );
    });
  });

  describe('when the server answers with a body that is not JSON', () => {
    let parseError: SyntaxError;

    beforeEach(async () => {
      parseError = new SyntaxError('Unexpected token < in JSON at position 0');
      fetchMock.mockResolvedValueOnce({ ok: true, json: () => Promise.reject(parseError) });
      limits = await new Worlds().fetchWorldLimits(
        'name.dcl.eth',
        ['0,0', '0,1'],
        controller.signal,
      );
    });

    it('should return null', () => {
      expect(limits).toBeNull();
    });

    it('should report the parse failure with the number of parcels, not the parcels', () => {
      expect(captureExceptionMock).toHaveBeenCalledWith(parseError, {
        tags: { source: 'worlds', event: 'fetch-world-limits' },
        extra: { worldName: 'name.dcl.eth', parcelCount: 2 },
      });
    });
  });

  describe('when the deadline aborts the request before the server answers', () => {
    beforeEach(async () => {
      fetchMock.mockImplementationOnce((_url: string, init: { signal: AbortSignal }) =>
        untilAborted(init.signal),
      );
      const request = new Worlds().fetchWorldLimits('name.dcl.eth', ['0,0'], controller.signal);
      controller.abort();
      limits = await request;
    });

    it('should give up and return null', () => {
      expect(limits).toBeNull();
    });

    it('should not report the timeout as an error', () => {
      expect(captureExceptionMock).not.toHaveBeenCalled();
    });
  });

  describe('when the deadline aborts the request while the body is being read', () => {
    beforeEach(async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => {
          controller.abort();
          return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
        },
      });
      limits = await new Worlds().fetchWorldLimits('name.dcl.eth', ['0,0'], controller.signal);
    });

    it('should give up and return null', () => {
      expect(limits).toBeNull();
    });

    it('should not report the timeout as a malformed response', () => {
      expect(captureExceptionMock).not.toHaveBeenCalled();
    });
  });

  describe('when the request fails', () => {
    beforeEach(async () => {
      fetchMock.mockRejectedValueOnce(new Error('Failed to fetch'));
      limits = await new Worlds().fetchWorldLimits('name.dcl.eth', ['0,0'], controller.signal);
    });

    it('should return null', () => {
      expect(limits).toBeNull();
    });
  });
});

describe('Worlds.fetchReplacedScenesParcels', () => {
  const scenesResponse = (scenes: { entityId: string; parcels: string[] }[], total: number) => ({
    ok: true,
    json: () => Promise.resolve({ scenes, total }),
  });
  const lookupRequest = (coordinates: string[]) => [
    `${WORLDS_SERVER}/world/my%20name.dcl.eth/scenes?limit=100`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coordinates }),
      signal: expect.any(AbortSignal),
    },
  ];

  let controller: AbortController;
  let replaced: string[][] | null;

  beforeEach(() => {
    fetchMock.mockReset();
    captureExceptionMock.mockReset();
    controller = new AbortController();
  });

  describe('when the parcels overlap deployed scenes', () => {
    beforeEach(async () => {
      fetchMock.mockResolvedValueOnce(
        scenesResponse(
          [
            { entityId: 'bafkreiexample1', parcels: ['0,0', '0,1'] },
            { entityId: 'bafkreiexample2', parcels: ['1,0'] },
          ],
          2,
        ),
      );
      replaced = await new Worlds().fetchReplacedScenesParcels(
        'my name.dcl.eth',
        ['0,1', '1,0'],
        controller.signal,
      );
    });

    it('should look up the scenes overlapping the parcels in a single request', () => {
      expect(fetchMock.mock.calls).toEqual([lookupRequest(['0,1', '1,0'])]);
    });

    it('should return the parcels of each scene', () => {
      expect(replaced).toEqual([['0,0', '0,1'], ['1,0']]);
    });
  });

  describe('when the parcels exceed a single page of scenes', () => {
    let parcels: string[];

    beforeEach(async () => {
      parcels = Array.from({ length: 101 }, (_, i) => `${i},0`);
      const spanningScene = { entityId: 'bafkreiexample1', parcels: ['99,0', '100,0'] };
      fetchMock
        .mockResolvedValueOnce(scenesResponse([spanningScene], 1))
        .mockResolvedValueOnce(scenesResponse([spanningScene], 1));
      replaced = await new Worlds().fetchReplacedScenesParcels(
        'my name.dcl.eth',
        parcels,
        controller.signal,
      );
    });

    it('should look them up in chunks of 100, each fitting in one page', () => {
      expect(fetchMock.mock.calls).toEqual([
        lookupRequest(parcels.slice(0, 100)),
        lookupRequest(parcels.slice(100)),
      ]);
    });

    it('should return a scene found by several chunks once', () => {
      expect(replaced).toEqual([['99,0', '100,0']]);
    });
  });

  describe('when a page with room left counts more scenes than it lists', () => {
    beforeEach(async () => {
      fetchMock.mockResolvedValueOnce(
        scenesResponse([{ entityId: 'bafkreiexample1', parcels: ['0,0'] }], 2),
      );
      replaced = await new Worlds().fetchReplacedScenesParcels(
        'name.dcl.eth',
        ['0,0'],
        controller.signal,
      );
    });

    it('should return the listed scenes, as a deploy between the count and the list is harmless', () => {
      expect(replaced).toEqual([['0,0']]);
    });

    it('should not report the response', () => {
      expect(captureExceptionMock).not.toHaveBeenCalled();
    });
  });

  describe('when a full page counts more scenes than it lists', () => {
    beforeEach(async () => {
      const parcels = Array.from({ length: 100 }, (_, i) => `${i},0`);
      const scenes = parcels.map((parcel, i) => ({
        entityId: `bafkreiexample${i}`,
        parcels: [parcel],
      }));
      fetchMock.mockResolvedValueOnce(scenesResponse(scenes, 101));
      replaced = await new Worlds().fetchReplacedScenesParcels(
        'name.dcl.eth',
        parcels,
        controller.signal,
      );
    });

    it('should return null rather than miss a replaced scene', () => {
      expect(replaced).toBeNull();
    });

    it('should report the truncated response', () => {
      expect(captureExceptionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'SceneLookupError',
          message: 'Truncated world scenes response',
        }),
        {
          tags: { source: 'worlds', event: 'fetch-replaced-scenes' },
          extra: { worldName: 'name.dcl.eth', parcelCount: 100, total: 101 },
        },
      );
    });
  });

  describe('when one chunk fails while another is still in flight', () => {
    let pendingSignal: AbortSignal;

    beforeEach(async () => {
      const cancelBody = vi.fn().mockResolvedValue(undefined);
      fetchMock
        .mockResolvedValueOnce({ ok: false, status: 500, body: { cancel: cancelBody } })
        .mockImplementationOnce((_url: string, init: { signal: AbortSignal }) => {
          pendingSignal = init.signal;
          return untilAborted(init.signal);
        });
      replaced = await new Worlds().fetchReplacedScenesParcels(
        'name.dcl.eth',
        Array.from({ length: 101 }, (_, i) => `${i},0`),
        controller.signal,
      );
    });

    it('should return null', () => {
      expect(replaced).toBeNull();
    });

    it('should abort the chunk still in flight', () => {
      expect(pendingSignal.aborted).toBe(true);
    });

    it('should report the failure once', () => {
      expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the server rejects the lookup', () => {
    let cancelBody: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      cancelBody = vi.fn().mockResolvedValue(undefined);
      fetchMock.mockResolvedValueOnce({ ok: false, status: 500, body: { cancel: cancelBody } });
      replaced = await new Worlds().fetchReplacedScenesParcels(
        'name.dcl.eth',
        ['0,0'],
        controller.signal,
      );
    });

    it('should return null', () => {
      expect(replaced).toBeNull();
    });

    it('should release the response body', () => {
      expect(cancelBody).toHaveBeenCalled();
    });

    it('should report the status with the number of parcels, not the parcels', () => {
      expect(captureExceptionMock).toHaveBeenCalledWith(expect.any(Error), {
        tags: { source: 'worlds', event: 'fetch-replaced-scenes' },
        extra: { worldName: 'name.dcl.eth', parcelCount: 1, status: 500 },
      });
    });
  });

  describe('when the server answers without a list of scenes', () => {
    beforeEach(async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ total: 1 }) });
      replaced = await new Worlds().fetchReplacedScenesParcels(
        'name.dcl.eth',
        ['0,0'],
        controller.signal,
      );
    });

    it('should return null', () => {
      expect(replaced).toBeNull();
    });

    it('should report the invalid response', () => {
      expect(captureExceptionMock).toHaveBeenCalledWith(expect.any(Error), {
        tags: { source: 'worlds', event: 'fetch-replaced-scenes' },
        extra: { worldName: 'name.dcl.eth', parcelCount: 1, total: 1 },
      });
    });
  });

  describe('when the server answers with a body that is not JSON', () => {
    beforeEach(async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new SyntaxError('Unexpected token < in JSON at position 0')),
      });
      replaced = await new Worlds().fetchReplacedScenesParcels(
        'name.dcl.eth',
        ['0,0'],
        controller.signal,
      );
    });

    it('should return null', () => {
      expect(replaced).toBeNull();
    });

    it('should report the malformed response', () => {
      expect(captureExceptionMock).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'World scenes response is not JSON' }),
        {
          tags: { source: 'worlds', event: 'fetch-replaced-scenes' },
          extra: { worldName: 'name.dcl.eth', parcelCount: 1 },
        },
      );
    });
  });

  describe('when the deadline aborts the lookup before the server answers', () => {
    beforeEach(async () => {
      fetchMock.mockImplementationOnce((_url: string, init: { signal: AbortSignal }) =>
        untilAborted(init.signal),
      );
      const request = new Worlds().fetchReplacedScenesParcels(
        'name.dcl.eth',
        ['0,0'],
        controller.signal,
      );
      controller.abort();
      replaced = await request;
    });

    it('should give up and return null', () => {
      expect(replaced).toBeNull();
    });

    it('should not report the timeout as an error', () => {
      expect(captureExceptionMock).not.toHaveBeenCalled();
    });
  });

  describe('when the deadline aborts the lookup while the body is being read', () => {
    beforeEach(async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => {
          controller.abort();
          return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
        },
      });
      replaced = await new Worlds().fetchReplacedScenesParcels(
        'name.dcl.eth',
        ['0,0'],
        controller.signal,
      );
    });

    it('should give up and return null', () => {
      expect(replaced).toBeNull();
    });

    it('should not report the timeout as a malformed response', () => {
      expect(captureExceptionMock).not.toHaveBeenCalled();
    });
  });
});
