import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WORLD_LIMITS_TIMEOUT_MS } from '/@/lib/worlds';
import type * as DeploymentUtils from '/@/modules/store/deployment/utils';

import { type SceneSizeLimit, useSceneSizeLimit } from './useSceneSizeLimit';

const fetchWorldSceneSizeLimitMock = vi.fn();
const cryptoFetchMock = vi.fn();

vi.mock('decentraland-crypto-fetch', () => ({
  default: (...args: unknown[]) => cryptoFetchMock(...args),
}));

vi.mock('/@/modules/store/deployment/utils', async importOriginal => ({
  ...(await importOriginal<typeof DeploymentUtils>()),
  fetchWorldSceneSizeLimit: (...args: unknown[]) => fetchWorldSceneSizeLimitMock(...args),
}));

type Target = Parameters<typeof useSceneSizeLimit>[0];

const MiB = 1024 * 1024;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('useSceneSizeLimit', () => {
  let result: { current: SceneSizeLimit };
  let rerender: (props: { target: Target }) => void;
  let unmount: () => void;

  const renderWith = (target: Target) => {
    ({ result, rerender, unmount } = renderHook(
      ({ target }: { target: Target }) => useSceneSizeLimit(target),
      { initialProps: { target } },
    ));
  };

  beforeEach(() => {
    fetchWorldSceneSizeLimitMock.mockReset();
  });

  describe('when there is no deployment yet', () => {
    beforeEach(() => {
      renderWith(undefined);
    });

    it('should report no limit without fetching one', () => {
      expect(result.current).toEqual({ limit: null, isLoading: false });
      expect(fetchWorldSceneSizeLimitMock).not.toHaveBeenCalled();
    });
  });

  describe('when publishing to Genesis City', () => {
    beforeEach(() => {
      renderWith({ isWorld: false, parcels: ['0,0', '0,1', '1,0'] });
    });

    it('should report 15 MiB per parcel on the first render', () => {
      expect(result.current).toEqual({ limit: 3 * 15 * MiB, isLoading: false });
    });

    it('should not ask the worlds server', () => {
      expect(fetchWorldSceneSizeLimitMock).not.toHaveBeenCalled();
    });
  });

  describe('when publishing to a world without a name', () => {
    beforeEach(() => {
      renderWith({ isWorld: true, parcels: ['0,0'] });
    });

    it('should report no limit without fetching one', () => {
      expect(result.current).toEqual({ limit: null, isLoading: false });
      expect(fetchWorldSceneSizeLimitMock).not.toHaveBeenCalled();
    });
  });

  describe('when publishing to a world', () => {
    let request: ReturnType<typeof deferred<number | null>>;

    beforeEach(() => {
      request = deferred<number | null>();
      fetchWorldSceneSizeLimitMock.mockReturnValueOnce(request.promise);
      renderWith({ isWorld: true, worldName: 'name.dcl.eth', parcels: ['0,0', '0,1'] });
    });

    it("should fetch the limit for the world and the deployment's parcels", () => {
      expect(fetchWorldSceneSizeLimitMock).toHaveBeenCalledWith('name.dcl.eth', ['0,0', '0,1'], {
        replacesWorld: false,
      });
    });

    it('should report the limit as loading while the request is in flight', () => {
      expect(result.current).toEqual({ limit: null, isLoading: true });
    });

    describe('and the server reports the limit', () => {
      beforeEach(async () => {
        await act(async () => request.resolve(200 * MiB));
      });

      it('should report the fetched limit', () => {
        expect(result.current).toEqual({ limit: 200 * MiB, isLoading: false });
      });
    });

    describe('and the limit cannot be known', () => {
      beforeEach(async () => {
        await act(async () => request.resolve(null));
      });

      it('should stop loading and report no limit', () => {
        expect(result.current).toEqual({ limit: null, isLoading: false });
      });
    });

    describe('and the target changes after the limit arrived', () => {
      let nextRequest: ReturnType<typeof deferred<number | null>>;

      beforeEach(async () => {
        await act(async () => request.resolve(200 * MiB));
        nextRequest = deferred<number | null>();
        fetchWorldSceneSizeLimitMock.mockReturnValueOnce(nextRequest.promise);
        rerender({ target: { isWorld: true, worldName: 'other.dcl.eth', parcels: ['0,0'] } });
      });

      it('should drop the previous limit and report loading', () => {
        expect(result.current).toEqual({ limit: null, isLoading: true });
      });

      it('should fetch the limit for the new target', () => {
        expect(fetchWorldSceneSizeLimitMock).toHaveBeenLastCalledWith('other.dcl.eth', ['0,0'], {
          replacesWorld: false,
        });
      });

      describe('and the new limit arrives', () => {
        beforeEach(async () => {
          await act(async () => nextRequest.resolve(100 * MiB));
        });

        it('should report the new limit', () => {
          expect(result.current).toEqual({ limit: 100 * MiB, isLoading: false });
        });
      });
    });

    describe('and the target changes before the first response, which then arrives last', () => {
      let nextRequest: ReturnType<typeof deferred<number | null>>;

      beforeEach(async () => {
        nextRequest = deferred<number | null>();
        fetchWorldSceneSizeLimitMock.mockReturnValueOnce(nextRequest.promise);
        rerender({ target: { isWorld: true, worldName: 'other.dcl.eth', parcels: ['0,0'] } });
        await act(async () => nextRequest.resolve(100 * MiB));
        await act(async () => request.resolve(200 * MiB));
      });

      it("should keep the current target's limit", () => {
        expect(result.current).toEqual({ limit: 100 * MiB, isLoading: false });
      });
    });

    describe('and the request fails', () => {
      beforeEach(async () => {
        fetchWorldSceneSizeLimitMock.mockReset();
        fetchWorldSceneSizeLimitMock.mockRejectedValueOnce(new Error('Failed to fetch'));
        rerender({ target: { isWorld: true, worldName: 'other.dcl.eth', parcels: ['0,0'] } });
        await waitFor(() => expect(result.current.isLoading).toBe(false));
      });

      it('should stop loading and report no limit', () => {
        expect(result.current).toEqual({ limit: null, isLoading: false });
      });
    });

    describe('and the hook unmounts before the response arrives', () => {
      let consoleError: ReturnType<typeof vi.spyOn>;

      beforeEach(async () => {
        consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        unmount();
        await act(async () => request.resolve(200 * MiB));
      });

      afterEach(() => {
        consoleError.mockRestore();
      });

      it('should ignore the response', () => {
        expect(consoleError).not.toHaveBeenCalled();
        expect(result.current).toEqual({ limit: null, isLoading: true });
      });
    });
  });

  describe('when a new deployment starts on the same world and parcels', () => {
    beforeEach(async () => {
      fetchWorldSceneSizeLimitMock.mockResolvedValue(200 * MiB);
      renderWith({
        isWorld: true,
        worldName: 'name.dcl.eth',
        parcels: ['0,0'],
        deploymentId: 'deployment-1',
      });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      rerender({
        target: {
          isWorld: true,
          worldName: 'name.dcl.eth',
          parcels: ['0,0'],
          deploymentId: 'deployment-2',
        },
      });
    });

    it('should fetch the limit again, as the earlier deployment changed what the world holds', () => {
      expect(fetchWorldSceneSizeLimitMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('when publishing to a world whose scenes are all removed before deploying', () => {
    beforeEach(() => {
      fetchWorldSceneSizeLimitMock.mockResolvedValue(200 * MiB);
      renderWith({
        isWorld: true,
        worldName: 'name.dcl.eth',
        parcels: ['0,0'],
        replacesWorld: true,
      });
    });

    it('should ask for the limit with the whole world credited back', () => {
      expect(fetchWorldSceneSizeLimitMock).toHaveBeenCalledWith('name.dcl.eth', ['0,0'], {
        replacesWorld: true,
      });
    });

    describe('and the world turns out not to be emptied', () => {
      beforeEach(() => {
        rerender({ target: { isWorld: true, worldName: 'name.dcl.eth', parcels: ['0,0'] } });
      });

      it('should fetch the limit again for the scene alone', () => {
        expect(fetchWorldSceneSizeLimitMock).toHaveBeenLastCalledWith('name.dcl.eth', ['0,0'], {
          replacesWorld: false,
        });
      });
    });
  });

  describe('when publishing to a world whose server never answers', () => {
    let consoleWarn: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
      vi.useFakeTimers();
      consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const { fetchWorldSceneSizeLimit } = await vi.importActual<typeof DeploymentUtils>(
        '/@/modules/store/deployment/utils',
      );
      fetchWorldSceneSizeLimitMock.mockImplementationOnce(fetchWorldSceneSizeLimit);
      cryptoFetchMock.mockImplementationOnce(
        (_url: string, init: { signal: AbortSignal }) =>
          new Promise((_, reject) => {
            init.signal.addEventListener('abort', () => reject(init.signal.reason));
          }),
      );
      renderWith({ isWorld: true, worldName: 'name.dcl.eth', parcels: ['0,0'] });
    });

    afterEach(() => {
      consoleWarn.mockRestore();
      vi.useRealTimers();
    });

    it('should report the limit as loading before the timeout', () => {
      expect(result.current).toEqual({ limit: null, isLoading: true });
    });

    describe('and the timeout elapses', () => {
      beforeEach(async () => {
        await act(() => vi.advanceTimersByTimeAsync(WORLD_LIMITS_TIMEOUT_MS));
      });

      it('should stop loading and report no limit, so publishing is not blocked', () => {
        expect(result.current).toEqual({ limit: null, isLoading: false });
      });
    });
  });
});
