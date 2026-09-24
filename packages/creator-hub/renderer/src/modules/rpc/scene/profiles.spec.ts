import { describe, expect, it, vi } from 'vitest';

import { config } from '/@/config';

import { resolveProfiles, sanitizeProfileAddresses } from './profiles';

const ADDRESS_A = '0xa11ce';
const ADDRESS_B = '0xb0b';
const ADDRESS_C = '0xc0de';
const ADDRESS_HEX = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed';

const FACE_HASH = 'bafkreih4nnedm6oa3h7ep6upgcbmmwzn6jdvvxwqhbrknbawwoyyjk3qzq';

type FakeProfile = {
  status: 'loading' | 'succeeded' | 'not_found';
  avatar?: { name?: string; avatar?: { snapshots?: { face256?: string } } };
};

const succeeded = (name: string, face256?: string): FakeProfile => ({
  status: 'succeeded',
  avatar: { name, avatar: face256 ? { snapshots: { face256 } } : undefined },
});

const fakeStore = (
  data: Record<string, FakeProfile>,
  dispatch: (action: any) => unknown = vi.fn(),
) => ({ getState: () => ({ profiles: { data } }), dispatch });

/**
 * Stands in for what dispatching an RTK thunk returns: awaitable *and* carrying an
 * `unwrap()`. One object satisfies both consumers, so a `Promise.all(...unwrap())`
 * implementation goes red for the batching hazard rather than for a missing method.
 */
const rejectingThunk = () => {
  const rejected = Object.assign(Promise.reject(new Error('boom')), {
    unwrap: () => Promise.reject(new Error('boom')),
  });
  rejected.catch(() => {});
  return rejected;
};

const resolvingThunk = () => {
  const resolved = Promise.resolve(undefined);
  return Object.assign(resolved, { unwrap: () => resolved });
};

describe('resolveProfiles', () => {
  describe('when one address fetch rejects', () => {
    it('should still return an entry for every requested address', async () => {
      const dispatch = vi
        .fn()
        .mockReturnValueOnce(rejectingThunk())
        .mockReturnValue(resolvingThunk());
      const store = fakeStore(
        { [ADDRESS_A]: succeeded('alice'), [ADDRESS_C]: succeeded('cody') },
        dispatch,
      );

      const profiles = await resolveProfiles(store, [ADDRESS_A, ADDRESS_B, ADDRESS_C]);

      expect(profiles.map($ => $.address)).toEqual([ADDRESS_A, ADDRESS_B, ADDRESS_C]);
      expect(profiles[0].name).toBe('alice');
      expect(profiles[1].name).toBeUndefined();
      expect(profiles[2].name).toBe('cody');
    });
  });

  describe('when no address is cached', () => {
    it('should return one entry per input address, in order', async () => {
      const store = fakeStore({});

      const profiles = await resolveProfiles(store, [ADDRESS_A, ADDRESS_B]);

      expect(profiles.map($ => $.address)).toEqual([ADDRESS_A, ADDRESS_B]);
    });
  });

  describe('when a cached address is marked not_found', () => {
    it('should fetch it again, since not_found is cached with no TTL', async () => {
      const dispatch = vi.fn();
      const store = fakeStore({ [ADDRESS_A]: { status: 'not_found' } }, dispatch);

      await resolveProfiles(store, [ADDRESS_A]);

      expect(dispatch).toHaveBeenCalledTimes(1);
    });
  });

  describe('when a cached address already succeeded', () => {
    it('should not fetch it again', async () => {
      const dispatch = vi.fn();
      const store = fakeStore({ [ADDRESS_A]: succeeded('alice') }, dispatch);

      await resolveProfiles(store, [ADDRESS_A]);

      expect(dispatch).not.toHaveBeenCalled();
    });
  });

  describe('when a snapshot is already an absolute URL', () => {
    it('should pass it through without prefixing the content server again', async () => {
      const absolute = `https://peer.decentraland.org/content/contents/${FACE_HASH}`;
      const store = fakeStore({ [ADDRESS_A]: succeeded('alice', absolute) });

      const [profile] = await resolveProfiles(store, [ADDRESS_A]);

      expect(profile.faceUrl).toBe(absolute);
    });
  });

  describe('when a snapshot is a bare content hash', () => {
    it('should compose it against the configured content server', async () => {
      const store = fakeStore({ [ADDRESS_A]: succeeded('alice', FACE_HASH) });

      const [profile] = await resolveProfiles(store, [ADDRESS_A]);

      const peerUrl = config.get('PEER_URL');
      expect(peerUrl).not.toBe('');
      expect(profile.faceUrl).toBe(`${peerUrl}/content/contents/${FACE_HASH}`);
    });
  });
});

describe('sanitizeProfileAddresses', () => {
  describe('when an element is not an address', () => {
    it('should drop a path-traversal payload and keep the real address', () => {
      expect(sanitizeProfileAddresses(['../../../lambdas/status', ADDRESS_HEX])).toEqual([
        ADDRESS_HEX,
      ]);
    });
  });

  describe('when an element is not a string', () => {
    it('should drop it', () => {
      expect(sanitizeProfileAddresses([null, 42, {}, [], ADDRESS_HEX])).toEqual([ADDRESS_HEX]);
    });
  });

  describe('when the caller supplies more addresses than the cap', () => {
    it('should keep at most one hundred', () => {
      const many = Array.from(
        { length: 500 },
        (_, index) => `0x${String(index).padStart(40, '0')}`,
      );

      expect(sanitizeProfileAddresses(many)).toHaveLength(100);
    });
  });

  describe('when the value is not an array', () => {
    it('should return nothing to act on', () => {
      expect(sanitizeProfileAddresses(undefined)).toEqual([]);
      expect(sanitizeProfileAddresses('0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed')).toEqual([]);
    });
  });

  describe('when an address omits the 0x prefix', () => {
    it('should keep it, since that spelling is stored and valid', () => {
      const prefixless = ADDRESS_HEX.slice(2);

      expect(sanitizeProfileAddresses([prefixless])).toEqual([prefixless]);
    });
  });

  describe('when an address carries checksum casing', () => {
    it('should keep it verbatim, so the response still echoes what was requested', () => {
      const checksummed = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';

      expect(sanitizeProfileAddresses([checksummed])).toEqual([checksummed]);
    });
  });

  describe('when an address carries an uppercase 0X prefix', () => {
    it('should keep it, since isAddress and toAllowlist both accept that spelling', () => {
      const uppercase = '0X5AAEB6053F3E94C9B9A09F33669435E7EF1BEAED';

      expect(sanitizeProfileAddresses([uppercase])).toEqual([uppercase]);
    });
  });
});
