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
