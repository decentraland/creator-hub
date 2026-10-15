import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

const { Worlds, WORLD_LIMITS_TIMEOUT_MS } = await import('./worlds');

/** A promise that only settles by rejecting once the signal aborts, like a request to a hung server. */
function untilAborted(signal: AbortSignal) {
  return new Promise<never>((_, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason));
  });
}

describe('Worlds.fetchWorldLimits', () => {
  let limits: WorldLimits | null;

  beforeEach(() => {
    fetchMock.mockReset();
    captureExceptionMock.mockReset();
  });

  describe('when the server reports the limits', () => {
    beforeEach(async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ maxSceneSizeInBytes: '524288000', maxParcels: 100 }),
      });
      limits = await new Worlds().fetchWorldLimits('my name.dcl.eth', ['0,0', '-1,2']);
    });

    it('should ask for the encoded world with one parcels param per parcel', () => {
      expect(fetchMock).toHaveBeenCalledWith(
        `${WORLDS_SERVER}/world/my%20name.dcl.eth/limits?parcels=0%2C0&parcels=-1%2C2`,
        { signal: expect.any(AbortSignal) },
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
      limits = await new Worlds().fetchWorldLimits('name.dcl.eth', ['0,0']);
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
      limits = await new Worlds().fetchWorldLimits('name.dcl.eth', ['0,0']);
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
      limits = await new Worlds().fetchWorldLimits('name.dcl.eth', ['0,0']);
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
      limits = await new Worlds().fetchWorldLimits('name.dcl.eth', ['0,0', '0,1']);
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

  describe('when the server never answers', () => {
    let request: Promise<WorldLimits | null>;

    beforeEach(() => {
      vi.useFakeTimers();
      fetchMock.mockImplementationOnce((_url: string, init: { signal: AbortSignal }) =>
        untilAborted(init.signal),
      );
      request = new Worlds().fetchWorldLimits('name.dcl.eth', ['0,0']);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    describe('and the timeout elapses', () => {
      beforeEach(async () => {
        await vi.advanceTimersByTimeAsync(WORLD_LIMITS_TIMEOUT_MS);
        limits = await request;
      });

      it('should give up and return null', () => {
        expect(limits).toBeNull();
      });

      it('should not report the timeout as an error', () => {
        expect(captureExceptionMock).not.toHaveBeenCalled();
      });
    });
  });

  describe('when the server stops sending the body', () => {
    let request: Promise<WorldLimits | null>;

    beforeEach(() => {
      vi.useFakeTimers();
      fetchMock.mockImplementationOnce((_url: string, init: { signal: AbortSignal }) =>
        Promise.resolve({ ok: true, json: () => untilAborted(init.signal) }),
      );
      request = new Worlds().fetchWorldLimits('name.dcl.eth', ['0,0']);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    describe('and the timeout elapses', () => {
      beforeEach(async () => {
        await vi.advanceTimersByTimeAsync(WORLD_LIMITS_TIMEOUT_MS);
        limits = await request;
      });

      it('should give up and return null', () => {
        expect(limits).toBeNull();
      });

      it('should not report the timeout as a malformed response', () => {
        expect(captureExceptionMock).not.toHaveBeenCalled();
      });
    });
  });

  describe('when the request fails', () => {
    beforeEach(async () => {
      fetchMock.mockRejectedValueOnce(new Error('Failed to fetch'));
      limits = await new Worlds().fetchWorldLimits('name.dcl.eth', ['0,0']);
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
  const lookupRequest = (offset: number, coordinates: string[]) => [
    `${WORLDS_SERVER}/world/my%20name.dcl.eth/scenes?limit=100&offset=${offset}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coordinates }),
      signal: expect.any(AbortSignal),
    },
  ];

  let replaced: string[][] | null;

  beforeEach(() => {
    fetchMock.mockReset();
    captureExceptionMock.mockReset();
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
      replaced = await new Worlds().fetchReplacedScenesParcels('my name.dcl.eth', ['0,1', '1,0']);
    });

    it('should look up the scenes overlapping the parcels in a single request', () => {
      expect(fetchMock.mock.calls).toEqual([lookupRequest(0, ['0,1', '1,0'])]);
    });

    it('should return the parcels of each scene', () => {
      expect(replaced).toEqual([['0,0', '0,1'], ['1,0']]);
    });
  });

  describe('when the parcels exceed what a single request accepts', () => {
    let parcels: string[];

    beforeEach(async () => {
      parcels = Array.from({ length: 501 }, (_, i) => `${i % 100},${Math.floor(i / 100)}`);
      const spanningScene = { entityId: 'bafkreiexample1', parcels: ['99,4', '0,5'] };
      fetchMock
        .mockResolvedValueOnce(scenesResponse([spanningScene], 1))
        .mockResolvedValueOnce(scenesResponse([spanningScene], 1));
      replaced = await new Worlds().fetchReplacedScenesParcels('my name.dcl.eth', parcels);
    });

    it('should look them up in chunks of 500', () => {
      expect(fetchMock.mock.calls).toEqual([
        lookupRequest(0, parcels.slice(0, 500)),
        lookupRequest(0, parcels.slice(500)),
      ]);
    });

    it('should return a scene found by several chunks once', () => {
      expect(replaced).toEqual([['99,4', '0,5']]);
    });
  });

  describe('when more scenes overlap than fit in a page', () => {
    beforeEach(async () => {
      const scenes = Array.from({ length: 101 }, (_, i) => ({
        entityId: `bafkreiexample${i}`,
        parcels: [`${i},0`],
      }));
      fetchMock
        .mockResolvedValueOnce(scenesResponse(scenes.slice(0, 100), 101))
        .mockResolvedValueOnce(scenesResponse(scenes.slice(100), 101));
      replaced = await new Worlds().fetchReplacedScenesParcels(
        'my name.dcl.eth',
        scenes.map(scene => scene.parcels[0]),
      );
    });

    it('should request the next page', () => {
      expect(fetchMock.mock.calls[1][0]).toBe(
        `${WORLDS_SERVER}/world/my%20name.dcl.eth/scenes?limit=100&offset=100`,
      );
    });

    it('should return the scenes of every page', () => {
      expect(replaced).toHaveLength(101);
    });
  });

  describe('when the server rejects the lookup', () => {
    let cancelBody: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      cancelBody = vi.fn().mockResolvedValue(undefined);
      fetchMock.mockResolvedValueOnce({ ok: false, status: 500, body: { cancel: cancelBody } });
      replaced = await new Worlds().fetchReplacedScenesParcels('name.dcl.eth', ['0,0']);
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
      replaced = await new Worlds().fetchReplacedScenesParcels('name.dcl.eth', ['0,0']);
    });

    it('should return null', () => {
      expect(replaced).toBeNull();
    });

    it('should report the invalid response', () => {
      expect(captureExceptionMock).toHaveBeenCalledWith(expect.any(Error), {
        tags: { source: 'worlds', event: 'fetch-replaced-scenes' },
        extra: { worldName: 'name.dcl.eth', parcelCount: 1 },
      });
    });
  });

  describe('when the server never answers', () => {
    let request: Promise<string[][] | null>;

    beforeEach(() => {
      vi.useFakeTimers();
      fetchMock.mockImplementationOnce((_url: string, init: { signal: AbortSignal }) =>
        untilAborted(init.signal),
      );
      request = new Worlds().fetchReplacedScenesParcels('name.dcl.eth', ['0,0']);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    describe('and the timeout elapses', () => {
      beforeEach(async () => {
        await vi.advanceTimersByTimeAsync(WORLD_LIMITS_TIMEOUT_MS);
        replaced = await request;
      });

      it('should give up and return null', () => {
        expect(replaced).toBeNull();
      });

      it('should not report the timeout as an error', () => {
        expect(captureExceptionMock).not.toHaveBeenCalled();
      });
    });
  });
});
