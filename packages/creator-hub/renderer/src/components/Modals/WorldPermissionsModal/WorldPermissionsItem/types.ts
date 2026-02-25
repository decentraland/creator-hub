import type { Option as DropdownOption } from '/@/components/Dropdown';
import type { WorldRoleType } from '/@/lib/worlds';

export type BaseProps = {
  walletAddress: string;
  icon?: React.ReactNode;
  name?: string;
  subtitle?: string;
  tag?: React.ReactNode;
  menuOptions?: DropdownOption[];
  className?: string;
  children?: React.ReactNode;
};

export type AccessItemProps = {
  walletAddress: string;
  icon?: React.ReactNode;
  name?: string;
  subtitle?: string;
  role?: WorldRoleType;
  onRemoveAddress: () => void;
};

export type CollaboratorsItemProps = {
  walletAddress: string;
  role?: WorldRoleType;
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
