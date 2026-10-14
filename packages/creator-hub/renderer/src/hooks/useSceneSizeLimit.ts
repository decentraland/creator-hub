import { useEffect, useMemo, useState } from 'react';

import {
  fetchWorldSceneSizeLimit,
  getGenesisCitySceneSizeLimit,
} from '/@/modules/store/deployment/utils';

export type SceneSizeLimit = {
  /** The whole-scene size limit of the publish target, `null` when it is not known. */
  limit: number | null;
  /** True while the limit is being fetched, so publishing can wait for it. */
  isLoading: boolean;
};

export function useSceneSizeLimit(target?: {
  isWorld: boolean;
  worldName?: string;
  parcels: string[];
}): SceneSizeLimit {
  const isWorld = target?.isWorld;
  const worldName = target?.worldName;
  const parcelCount = target?.parcels.length;
  const parcelsKey = target?.parcels.join(';');
  const worldRequestKey =
    isWorld && worldName && parcelsKey !== undefined ? `${worldName}|${parcelsKey}` : null;

  // Tagged with the request it answers, so a stale result is never read as the current target's.
  const [worldLimit, setWorldLimit] = useState<{ requestKey: string; limit: number | null }>();

  useEffect(() => {
    if (worldRequestKey === null || !worldName || parcelsKey === undefined) return;

    let cancelled = false;
    const parcels = parcelsKey ? parcelsKey.split(';') : [];
    void fetchWorldSceneSizeLimit(worldName, parcels)
      .catch(() => null)
      .then(limit => {
        if (!cancelled) setWorldLimit({ requestKey: worldRequestKey, limit });
      });
    return () => {
      cancelled = true;
    };
  }, [worldRequestKey, worldName, parcelsKey]);

  return useMemo(() => {
    if (isWorld === false && parcelCount !== undefined) {
      return { limit: getGenesisCitySceneSizeLimit(parcelCount), isLoading: false };
    }
    if (worldRequestKey === null) return { limit: null, isLoading: false };
    if (worldLimit?.requestKey !== worldRequestKey) return { limit: null, isLoading: true };
    return { limit: worldLimit.limit, isLoading: false };
  }, [isWorld, parcelCount, worldRequestKey, worldLimit]);
}
