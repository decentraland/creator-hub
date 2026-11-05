import { config } from '/@/config';
import type { AppState } from '/@/modules/store';

import { actions as profilesActions, selectors as profilesSelectors } from '../../store/profiles';

export type ProfileSummary = {
  address: string;
  /** Absolute URL, composed host-side — `face256` is a content hash, not a URL. */
  faceUrl?: string;
  name?: string;
};

type ProfileStore = {
  getState: () => AppState;
  dispatch: (action: any) => unknown;
};

/**
 * `/lambdas/profiles/:address` is the catalyst's projection of the deployed entity, and it
 * may already have rewritten the snapshot hash into an absolute URL. Prefixing
 * unconditionally would yield a double-prefixed 404 that renders as a broken image rather
 * than as the designed placeholder, so the composition is idempotent.
 */
const toFaceUrl = (face256: string) =>
  /^https?:\/\//.test(face256) ? face256 : `${config.get('PEER_URL')}/content/contents/${face256}`;

const MAX_PROFILE_ADDRESSES = 100;

const ADDRESS_PATTERN = /^(0x)?[0-9a-f]{40}$/i;

/**
 * The address list `get_profiles` may act on: address-shaped strings only, capped.
 * The iframe chooses this array, and each element becomes a path segment of an outbound
 * request and a unit of concurrent work, so neither its contents nor its length may be
 * taken on trust.
 */
export function sanitizeProfileAddresses(addresses: unknown): string[] {
  if (!Array.isArray(addresses)) return [];
  return addresses
    .filter(
      (address): address is string => typeof address === 'string' && ADDRESS_PATTERN.test(address),
    )
    .slice(0, MAX_PROFILE_ADDRESSES);
}

/**
 * Resolve each address through the host's profile cache, fetching only the ones it has not
 * resolved yet. Returns one entry per input address in every failure mode: the response is
 * built by mapping over `addresses` and reading the store back, never from the fetch
 * results, so a single failing address cannot empty the batch.
 *
 * Takes the store as a parameter — importing the singleton boots the whole app.
 */
export async function resolveProfiles(
  store: ProfileStore,
  addresses: string[],
): Promise<ProfileSummary[]> {
  const unresolved = addresses.filter(
    address => profilesSelectors.getProfile(store.getState(), address)?.status !== 'succeeded',
  );

  await Promise.allSettled(
    unresolved.map(address => store.dispatch(profilesActions.fetchProfile({ address }))),
  );

  const state = store.getState();
  return addresses.map(address => {
    const avatar = profilesSelectors.getProfile(state, address)?.avatar;
    const face256 = avatar?.avatar?.snapshots?.face256;
    return { address, name: avatar?.name, faceUrl: face256 ? toFaceUrl(face256) : undefined };
  });
}
