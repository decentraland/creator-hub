import type { Option as DropdownOption } from '/@/components/Dropdown';

export type BaseProps = {
  walletAddress: string;
  menuOptions?: DropdownOption[];
  children?: React.ReactNode;
};

export type AccessItemProps = {
  walletAddress: string;
  role?: 'owner' | 'collaborator';
  onRemoveAddress: () => void;
};

export type CollaboratorsItemProps = {
  walletAddress: string;
  hasDeploymentPermission: boolean;
  hasStreamingPermission: boolean;
  allowedParcelsCount?: number;
  onGrantWorldWideDeploymentPermission: () => void;
  onGrantParcelsDeploymentPermission: () => void;
  onRemoveCollaborator: () => void;
};

export enum DeploymentOptionValue {
  WorldWide = 'world_wide',
  Parcels = 'parcels',
  None = 'none',
}

export type DeploymentOption = {
  value: DeploymentOptionValue;
  label: string;
  disabled?: boolean;
};
