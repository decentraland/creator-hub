import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';

import type { ProfileSummary } from '../lib/rpc/scene/client';
import { useProfiles } from './useProfiles';

const mocks = vi.hoisted(() => ({
  getProfiles: vi.fn(),
  hasSceneClient: true,
}));

vi.mock('../lib/rpc/scene', () => ({
  getSceneClient: () => (mocks.hasSceneClient ? { getProfiles: mocks.getProfiles } : undefined),
}));

const ADDRESS_A = '0x1111111111111111111111111111111111111111';
const ADDRESS_B = '0x2222222222222222222222222222222222222222';

const PROFILE_A: ProfileSummary = {
  address: ADDRESS_A,
  name: 'alice',
  faceUrl: 'https://example.com/alice.png',
};
const PROFILE_B: ProfileSummary = {
  address: ADDRESS_B,
  name: 'bob',
  faceUrl: 'https://example.com/bob.png',
};

const flush = () => act(async () => undefined);

beforeEach(() => {
  vi.useFakeTimers();
  mocks.getProfiles.mockReset();
  mocks.hasSceneClient = true;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('when the address list changes', () => {
  it('should keep the profiles it already resolved, so no row blanks while the batch is in flight', async () => {
    mocks.getProfiles.mockResolvedValue({ profiles: [PROFILE_A] });

    const { result, rerender } = renderHook(({ list }) => useProfiles(list), {
      initialProps: { list: [ADDRESS_A] },
    });
    await flush();
    expect(result.current[ADDRESS_A]).toEqual(PROFILE_A);

    let resolveSecond: (value: { profiles: ProfileSummary[] }) => void = () => {};
    mocks.getProfiles.mockReturnValue(
      new Promise<{ profiles: ProfileSummary[] }>(resolve => {
        resolveSecond = resolve;
      }),
    );

    rerender({ list: [ADDRESS_A, ADDRESS_B] });
    await flush();

    expect(result.current[ADDRESS_A]).toEqual(PROFILE_A);

    await act(async () => {
      resolveSecond({ profiles: [PROFILE_A, PROFILE_B] });
    });

    expect(result.current).toEqual({ [ADDRESS_A]: PROFILE_A, [ADDRESS_B]: PROFILE_B });
  });
});

describe('when the host resolves the addresses', () => {
  it('should key every profile by its address', async () => {
    mocks.getProfiles.mockResolvedValue({ profiles: [PROFILE_A, PROFILE_B] });

    const { result } = renderHook(() => useProfiles([ADDRESS_A, ADDRESS_B]));
    await flush();

    expect(mocks.getProfiles).toHaveBeenCalledWith([ADDRESS_A, ADDRESS_B]);
    expect(result.current).toEqual({ [ADDRESS_A]: PROFILE_A, [ADDRESS_B]: PROFILE_B });
  });

  it('should keep an address the host could not resolve, with no name', async () => {
    mocks.getProfiles.mockResolvedValue({ profiles: [PROFILE_A, { address: ADDRESS_B }] });

    const { result } = renderHook(() => useProfiles([ADDRESS_A, ADDRESS_B]));
    await flush();

    expect(result.current[ADDRESS_B]).toEqual({ address: ADDRESS_B });
    expect(result.current[ADDRESS_B].name).toBeUndefined();
  });
});

describe('when there is no host', () => {
  it('should resolve nothing without calling the host', async () => {
    mocks.hasSceneClient = false;

    const { result } = renderHook(() => useProfiles([ADDRESS_A]));
    await flush();

    expect(result.current).toEqual({});
    expect(mocks.getProfiles).not.toHaveBeenCalled();
  });
});

describe('when the request never settles', () => {
  it('should give up once the bound elapses, and ignore the late answer', async () => {
    let settle: (value: { profiles: ProfileSummary[] }) => void = () => undefined;
    mocks.getProfiles.mockReturnValue(
      new Promise<{ profiles: ProfileSummary[] }>(resolve => {
        settle = resolve;
      }),
    );

    const { result } = renderHook(() => useProfiles([ADDRESS_A]));
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    expect(result.current).toEqual({});

    await act(async () => {
      settle({ profiles: [PROFILE_A] });
    });

    expect(result.current).toEqual({});
  });
});

describe('when the request rejects', () => {
  it('should resolve nothing and throw nothing at the caller', async () => {
    mocks.getProfiles.mockRejectedValue(new Error('transport closed'));

    const { result } = renderHook(() => useProfiles([ADDRESS_A]));
    await flush();

    expect(result.current).toEqual({});
  });
});

describe('when the caller re-renders with a fresh array of the same addresses', () => {
  it('should request once', async () => {
    mocks.getProfiles.mockResolvedValue({ profiles: [PROFILE_A] });

    const { rerender } = renderHook(({ addresses }) => useProfiles(addresses), {
      initialProps: { addresses: [ADDRESS_A] },
    });
    await flush();

    rerender({ addresses: [ADDRESS_A] });
    await flush();

    expect(mocks.getProfiles).toHaveBeenCalledTimes(1);
  });
});
