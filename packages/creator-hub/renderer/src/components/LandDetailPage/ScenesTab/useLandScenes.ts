import { useCallback, useEffect, useMemo } from 'react';

import { useDispatch, useSelector } from '#store';
import { Lands, type Land } from '/@/lib/land';
import { fetchLandDeployers, unpublishLandScene } from '/@/modules/store/management/slice';
import { toLandScenes, type LandScene } from '/@/modules/store/management/utils';

/** The LAND's deployed scenes, their deployers, and how to unpublish one. */
export function useLandScenes(land: Land) {
  const dispatch = useDispatch();
  const deployments = useSelector(state => state.management.lands.deployments[land.id]);
  const deployers = useSelector(state => state.management.lands.deployers);
  const scenes = useMemo(
    () => toLandScenes(deployments ?? [], hash => new Lands().getContentSrcUrl(hash)),
    [deployments],
  );

  useEffect(() => {
    if (scenes.length) void dispatch(fetchLandDeployers(scenes.map(scene => scene.id)));
  }, [scenes, dispatch]);

  const unpublishScene = useCallback(
    (scene: LandScene) =>
      dispatch(
        unpublishLandScene({ scene: { base: scene.base, parcels: scene.parcels } }),
      ).unwrap(),
    [dispatch],
  );

  return { scenes, deployers, unpublishScene };
}
