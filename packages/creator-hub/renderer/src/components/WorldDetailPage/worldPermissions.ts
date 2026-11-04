import { WorldRoleType } from '/@/lib/worlds';
import type { ManagedProject } from '/shared/types/manage';

export type WorldTab = 'details' | 'scenes' | 'settings' | 'collaborators';

/** How far a collaborator's deploy grant reaches: the whole World, or some of its parcels. */
export type DeployScope = 'world' | 'parcels';

export type WorldPermissions = {
  tabs: WorldTab[];
  scenes: 'manage' | 'view';
  header: 'owner' | 'collaborator';
  /** Who may change who enters the World. The Worlds server takes access writes from the owner only. */
  access: 'manage' | 'hidden';
};

const OWNER: WorldPermissions = {
  tabs: ['details', 'scenes', 'settings', 'collaborators'],
  scenes: 'manage',
  header: 'owner',
  access: 'manage',
};

// The Worlds server accepts a settings PUT from a world-wide deployer as well as the owner, so they
// get Details and Settings, as they did in the retired World Settings modal; permissions stay the owner's.
const WORLD_WIDE_COLLABORATOR: WorldPermissions = {
  tabs: ['details', 'scenes', 'settings'],
  scenes: 'view',
  header: 'collaborator',
  access: 'hidden',
};

const PARCEL_COLLABORATOR: WorldPermissions = {
  tabs: ['scenes'],
  scenes: 'view',
  header: 'collaborator',
  access: 'hidden',
};

/** What a role can see and do on the World detail page; `null` when it has no page (stream-only). */
export function getWorldPermissions(
  project: ManagedProject,
  deployScope: DeployScope = 'parcels',
): WorldPermissions | null {
  if (project.access === 'stream') return null;
  switch (project.role) {
    case WorldRoleType.OWNER:
      return OWNER;
    case WorldRoleType.COLLABORATOR:
      return deployScope === 'world' ? WORLD_WIDE_COLLABORATOR : PARCEL_COLLABORATOR;
    default:
      return null;
  }
}
