import { useCallback, useEffect, useMemo, useState } from 'react';

import { useDispatch, useSelector } from '#store';
import { useAuth } from '/@/hooks/useAuth';
import { WorldPermissionName } from '/@/lib/worlds';
import {
  fetchParcelsPermission,
  fetchWorldPermissions,
  fetchWorldScenes,
  unpublishWorldScene,
} from '/@/modules/store/management/slice';
import type { LandScene } from '/@/modules/store/management/utils';

import type { RowMode } from '../../LandDetailPage/ScenesTab/SceneRow';
import { scenesOnParcels, toWorldScenes } from './worldScenes';

/** The World's scenes (all of them, and the rows the account may see), their deployers, and how to unpublish one. */
export function useWorldScenes(worldName: string, mode: RowMode) {
  const dispatch = useDispatch();
  const { wallet } = useAuth();
  const [loaded, setLoaded] = useState(false);
  const settings = useSelector(state => state.management.worldSettings);
  const permissions = useSelector(state => state.management.worldPermissions);
  const all = useMemo(
    () => (settings.worldName === worldName ? settings.scenes : []),
    [settings.worldName, settings.scenes, worldName],
  );

  useEffect(() => {
    void dispatch(fetchWorldScenes({ worldName })).finally(() => setLoaded(true));
  }, [dispatch, worldName]);

  useEffect(() => {
    if (mode === 'view') void dispatch(fetchWorldPermissions({ worldName }));
  }, [dispatch, worldName, mode]);

  const summary = permissions.worldName === worldName ? permissions.summary : undefined;
  const deployment = wallet
    ? (summary?.[wallet] ?? summary?.[wallet.toLowerCase()])?.find(
        entry => entry.permission === 'deployment',
      )
    : undefined;
  const parcels = wallet ? permissions.parcels[wallet] : undefined;
  const parcelsWanted = mode === 'view' && !!deployment && !deployment.worldWide;

  useEffect(() => {
    if (parcelsWanted && wallet)
      void dispatch(
        fetchParcelsPermission({
          worldName,
          permissionName: WorldPermissionName.Deployment,
          walletAddress: wallet,
        }),
      );
  }, [dispatch, worldName, wallet, parcelsWanted]);

  const allowed: 'all' | Set<string> | undefined =
    mode === 'manage' || deployment?.worldWide
      ? 'all'
      : parcels?.status === 'succeeded'
        ? new Set(parcels.parcels)
        : undefined;
  const ready = loaded && (mode === 'manage' || (!!summary && (!parcelsWanted || !!allowed)));

  const rows = useMemo(() => toWorldScenes(all), [all]);
  const scenes = allowed ? scenesOnParcels(rows, allowed) : [];
  const deployers = useMemo(
    () => Object.fromEntries(all.map(scene => [scene.entityId, scene.deployer])),
    [all],
  );

  const unpublishScene = useCallback(
    (scene: LandScene) =>
      dispatch(unpublishWorldScene({ worldName, sceneCoord: scene.parcels[0] })).unwrap(),
    [dispatch, worldName],
  );

  return { all, scenes, deployers, ready, unpublishScene };
}
