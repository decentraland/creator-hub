import { useDispatch } from '#store';
import {
  WorldPermissionName,
  WorldPermissionType,
  type AllowListPermissionSetting,
  type WorldPermissions,
} from '/@/lib/worlds';
import {
  addAddressPermission,
  removeAddressPermission,
  updateWorldPermissions,
} from '/@/modules/store/management/slice';

type Access = WorldPermissions['access'] | undefined;

const allowList = (access: Access): AllowListPermissionSetting | null =>
  access?.type === WorldPermissionType.AllowList ? access : null;

/** The World's access writes, each sent at once (as the old permissions modal did). */
export function useAccessActions(worldName: string, access: Access) {
  const dispatch = useDispatch();
  const list = allowList(access);
  const wallets = list?.wallets ?? [];
  const communities = list?.communities ?? [];

  const writeList = (next: { wallets: string[]; communities: string[] }) =>
    dispatch(
      updateWorldPermissions({
        worldName,
        worldPermissionName: WorldPermissionName.Access,
        worldPermissionType: WorldPermissionType.AllowList,
        options: next,
      }),
    );

  return {
    changeType: (type: WorldPermissionType) =>
      dispatch(
        updateWorldPermissions({
          worldName,
          worldPermissionName: WorldPermissionName.Access,
          worldPermissionType: type,
        }),
      ),
    setPassword: (secret: string) =>
      dispatch(
        updateWorldPermissions({
          worldName,
          worldPermissionName: WorldPermissionName.Access,
          worldPermissionType: WorldPermissionType.SharedSecret,
          options: { secret },
        }),
      ),
    addWallet: (address: string) => {
      const wallet = address.toLowerCase();
      if (!list || wallets.includes(wallet)) return;
      return dispatch(
        addAddressPermission({
          worldName,
          permissionName: WorldPermissionName.Access,
          walletAddress: wallet,
        }),
      );
    },
    addCommunity: (id: string) => {
      if (!list || communities.includes(id)) return;
      return writeList({ wallets, communities: [...communities, id] });
    },
    addCsv: (data: { addresses: string[]; communityIds: string[] }) => {
      if (!list) return;
      const newWallets = data.addresses.filter(wallet => !wallets.includes(wallet));
      const newCommunities = data.communityIds.filter(id => !communities.includes(id));
      if (!newWallets.length && !newCommunities.length) return;
      return writeList({
        wallets: [...wallets, ...newWallets],
        communities: [...communities, ...newCommunities],
      });
    },
    remove: async (removed: { wallets: string[]; communities: string[] }) => {
      for (const wallet of removed.wallets) {
        await dispatch(
          removeAddressPermission({
            worldName,
            permissionName: WorldPermissionName.Access,
            walletAddress: wallet,
          }),
        );
      }
      if (removed.communities.length)
        await writeList({
          wallets: wallets.filter(wallet => !removed.wallets.includes(wallet)),
          communities: communities.filter(id => !removed.communities.includes(id)),
        });
    },
  };
}
