import { useEffect, useState } from 'react';

import { fetchSceneSizeLimit } from '/@/modules/store/deployment/utils';

/** The whole-scene size limit of the publish target, `null` while unknown. */
export function useSceneSizeLimit(target?: {
  isWorld: boolean;
  worldName?: string;
  parcels: string[];
}): number | null {
  const [limit, setLimit] = useState<number | null>(null);
  const isWorld = target?.isWorld;
  const worldName = target?.worldName;
  const parcelsKey = target?.parcels.join(';');

  useEffect(() => {
    setLimit(null);
    if (isWorld === undefined || parcelsKey === undefined) return;

    let cancelled = false;
    const parcels = parcelsKey ? parcelsKey.split(';') : [];
    void fetchSceneSizeLimit({ isWorld, worldName, parcels }).then(value => {
      if (!cancelled) setLimit(value);
    });
    return () => {
      cancelled = true;
    };
  }, [isWorld, worldName, parcelsKey]);

  return limit;
}
