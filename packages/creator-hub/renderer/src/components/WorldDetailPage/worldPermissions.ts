import { WorldRoleType } from '/@/lib/worlds';
import type { ManagedProject } from '/shared/types/manage';

export type WorldTab = 'details' | 'scenes' | 'settings' | 'collaborators';

export type WorldPermissions = {
  tabs: WorldTab[];
  scenes: 'manage' | 'view';
  header: 'owner' | 'collaborator';
};

const PERMISSIONS: Record<WorldRoleType, WorldPermissions> = {
  [WorldRoleType.OWNER]: {
    tabs: ['details', 'scenes', 'settings', 'collaborators'],
    scenes: 'manage',
    header: 'owner',
  },
  [WorldRoleType.COLLABORATOR]: {
    tabs: ['scenes'],
    scenes: 'view',
    header: 'collaborator',
  },
};

/** What a role can see and do on the World detail page; `null` when it has no page (stream-only). */
export function getWorldPermissions(project: ManagedProject): WorldPermissions | null {
  if (project.access === 'stream') return null;
  return PERMISSIONS[project.role as WorldRoleType] ?? null;
}
