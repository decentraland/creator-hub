import type { WorldPermissionName, WorldPermissionType } from '/@/lib/worlds';

export type WorldPermissionsPayload = {
  worldName: string;
  worldPermissionName: WorldPermissionName;
  worldPermissionType: WorldPermissionType;
  options?: {
    secret?: string;
    wallets?: string[];
    communities?: string[];
  };
};

export type AddressPermissionPayload = {
  worldName: string;
  permissionName: WorldPermissionName;
  walletAddress: string;
};

export type ParcelsPermissionPayload = {
  worldName: string;
  permissionName: WorldPermissionName;
  walletAddress: string;
  parcels: string[];
};
