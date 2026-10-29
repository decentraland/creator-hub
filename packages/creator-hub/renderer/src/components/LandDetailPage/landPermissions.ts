import { RoleType } from '/@/lib/land';

export type LandTab = 'details' | 'scenes' | 'collaborators' | 'managers';

type LandPermissions = {
  tabs: LandTab[];
  transfer: boolean;
  editDetails: boolean;
  unpublish: boolean;
  roleRow: boolean;
};

const BASIC: LandTab[] = ['details', 'scenes'];

const PERMISSIONS: Record<RoleType, LandPermissions> = {
  [RoleType.OWNER]: {
    tabs: ['details', 'scenes', 'collaborators', 'managers'],
    transfer: true,
    editDetails: true,
    unpublish: true,
    roleRow: false,
  },
  [RoleType.LESSOR]: {
    tabs: BASIC,
    transfer: false,
    editDetails: false,
    unpublish: false,
    roleRow: false,
  },
  [RoleType.MANAGER]: {
    tabs: ['details', 'scenes', 'collaborators'],
    transfer: false,
    editDetails: true,
    unpublish: true,
    roleRow: true,
  },
  [RoleType.OPERATOR]: {
    tabs: BASIC,
    transfer: false,
    editDetails: true,
    unpublish: true,
    roleRow: true,
  },
  [RoleType.TENANT]: {
    tabs: BASIC,
    transfer: false,
    editDetails: false,
    unpublish: true,
    roleRow: true,
  },
};

/** What a role can see and do on the LAND detail page. */
export function getLandPermissions(role: RoleType): LandPermissions {
  return PERMISSIONS[role];
}
