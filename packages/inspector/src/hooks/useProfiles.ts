import { useEffect, useState } from 'react';

import { getSceneClient } from '../lib/rpc/scene';
import type { ProfileSummary } from '../lib/rpc/scene/client';

const RESPONSE_TIMEOUT_MS = 8000;

/**
 * Resolve wallet addresses to profiles through the Creator Hub host.
 *
 * Returns a map keyed by address. A missing entry means "not resolved" —
 * whether the host said so, the request timed out, or there is no host at all.
 */
export function useProfiles(addresses: string[]): Record<string, ProfileSummary> {
  const [profiles, setProfiles] = useState<Record<string, ProfileSummary>>({});
  const addressesKey = JSON.stringify(addresses);

  useEffect(() => {
    const requested: string[] = JSON.parse(addressesKey);
    const client = getSceneClient();
    if (!client || requested.length === 0) return;

    let cancelled = false;
    const timeout = setTimeout(() => {
      cancelled = true;
    }, RESPONSE_TIMEOUT_MS);

    client
      .getProfiles(requested)
      .then(({ profiles: resolved }) => {
        if (cancelled) return;
        setProfiles(current => ({
          ...current,
          ...Object.fromEntries(resolved.map(profile => [profile.address, profile])),
        }));
      })
      .catch(() => {})
      .finally(() => clearTimeout(timeout));

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [addressesKey]);

  return profiles;
}
