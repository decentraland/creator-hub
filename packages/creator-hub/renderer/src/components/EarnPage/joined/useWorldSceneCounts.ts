import { useEffect } from 'react';

import type { CreatorFundPlace } from '/shared/types/creator-fund';

import { useDispatch, useSelector } from '#store';
import { actions } from '/@/modules/store/creatorFund';

/** Scenes per World for the shown places, fetched once per World name; unknown until it resolves. */
export function useWorldSceneCounts(places: Pick<CreatorFundPlace, 'world' | 'world_name'>[]) {
  const dispatch = useDispatch();
  const counts = useSelector(state => state.creatorFund.worldSceneCounts);
  const worlds = [
    ...new Set(
      places.flatMap(place => (place.world && place.world_name ? [place.world_name] : [])),
    ),
  ];
  const key = worlds.join('\n');

  useEffect(() => {
    worlds.forEach(world => void dispatch(actions.fetchWorldSceneCount(world)));
  }, [key, dispatch]);

  return counts;
}
