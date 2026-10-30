import { useCallback, useEffect, useMemo } from 'react';

import { useDispatch, useSelector } from '#store';
import { WorldPermissionName } from '/@/lib/worlds';
import {
  addAddressPermission,
  addParcelsPermission,
  fetchParcelsPermission,
  fetchWorldPermissions,
  fetchWorldScenes,
  removeAddressPermission,
  removeParcelsPermission,
} from '/@/modules/store/management/slice';

import { getWorldCollaborators, isStreamOpen, type WorldCollaborator } from './worldCollaborators';

const { Deployment, Streaming } = WorldPermissionName;

/** The World's collaborators, its scenes' parcels, and the off-chain changes the Collaborators tab makes. */
export function useWorldCollaborators(worldName: string) {
  const dispatch = useDispatch();
  const state = useSelector(store => store.management.worldPermissions);
  const settings = useSelector(store => store.management.worldSettings);

  useEffect(() => {
    void dispatch(fetchWorldPermissions({ worldName }));
    void dispatch(fetchWorldScenes({ worldName }));
  }, [dispatch, worldName]);

  const own = state.worldName === worldName;
  const collaborators = useMemo(
    () =>
      own
        ? getWorldCollaborators({
            owner: state.owner,
            permissions: state.permissions,
            summary: state.summary,
          })
        : [],
    [own, state.owner, state.permissions, state.summary],
  );
  const scenes = useMemo(
    () =>
      settings.worldName === worldName ? settings.scenes.map(({ parcels }) => ({ parcels })) : [],
    [settings.worldName, settings.scenes, worldName],
  );

  const grant = useCallback(
    (permissionName: WorldPermissionName, walletAddress: string) =>
      dispatch(addAddressPermission({ worldName, permissionName, walletAddress })).unwrap(),
    [dispatch, worldName],
  );
  const revoke = useCallback(
    (permissionName: WorldPermissionName, walletAddress: string) =>
      dispatch(removeAddressPermission({ worldName, permissionName, walletAddress })).unwrap(),
    [dispatch, worldName],
  );

  const remove = useCallback(
    async (rows: WorldCollaborator[]) => {
      for (const row of rows) {
        if (row.deploy.kind !== 'none') await revoke(Deployment, row.address);
        if (row.stream) await revoke(Streaming, row.address);
      }
    },
    [revoke],
  );

  const parcelsOf = useCallback(
    async (walletAddress: string) => {
      const result = await dispatch(
        fetchParcelsPermission({ worldName, permissionName: Deployment, walletAddress }),
      ).unwrap();
      return new Set(result.parcels?.parcels ?? []);
    },
    [dispatch, worldName],
  );

  const setParcels = useCallback(
    async (walletAddress: string, chosen: string[], previous: Set<string>) => {
      const next = new Set(chosen);
      const added = chosen.filter(parcel => !previous.has(parcel));
      const dropped = [...previous].filter(parcel => !next.has(parcel));
      const payload = { worldName, permissionName: Deployment, walletAddress };
      if (added.length)
        await dispatch(addParcelsPermission({ ...payload, parcels: added })).unwrap();
      if (dropped.length)
        await dispatch(removeParcelsPermission({ ...payload, parcels: dropped })).unwrap();
    },
    [dispatch, worldName],
  );

  return {
    loaded: own && !!state.permissions,
    streamOpen: own && isStreamOpen(state.permissions),
    collaborators,
    scenes,
    add: (address: string) => grant(Deployment, address.toLowerCase()),
    deployEverywhere: (address: string) => grant(Deployment, address),
    deployNowhere: (address: string) => revoke(Deployment, address),
    setStream: (address: string, on: boolean) =>
      on ? grant(Streaming, address) : revoke(Streaming, address),
    remove,
    parcelsOf,
    setParcels,
  };
}
