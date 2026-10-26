import { RoleType } from '/@/lib/land';
import { WorldRoleType } from '/@/lib/worlds';
import { t } from '/@/modules/store/translation/utils';
import type { ManagedProject } from '/shared/types/manage';

import type { RoleTagVariant } from './types';
import { Tag } from './RoleTag.styled';

const TAG_BY_ROLE: Partial<Record<ManagedProject['role'], RoleTagVariant>> = {
  [RoleType.OPERATOR]: 'collaborator',
  [RoleType.MANAGER]: 'manager',
  [RoleType.TENANT]: 'tenant',
  [WorldRoleType.COLLABORATOR]: 'collaborator',
};

const LABELS = {
  collaborator: 'manage.cards.roles.collaborator',
  manager: 'manage.cards.roles.manager',
  tenant: 'manage.cards.roles.tenant',
} as const satisfies Record<RoleTagVariant, string>;

/** The tag a card shows for the account's role; owners and lessors get none. */
export function getRoleTag(role: ManagedProject['role']): RoleTagVariant | undefined {
  return TAG_BY_ROLE[role];
}

export function RoleTag({ variant }: { variant: RoleTagVariant }) {
  return <Tag variant={variant}>{t(LABELS[variant])}</Tag>;
}
