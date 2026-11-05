import {
  WorldPermissionType,
  type AddressWorldPermission,
  type WorldPermissions,
} from '/@/lib/worlds';

export const MAX_COLLABORATORS = 100;

export type DeployScope = { kind: 'all' } | { kind: 'parcels'; count: number } | { kind: 'none' };
export type WorldCollaborator = { address: string; deploy: DeployScope; stream: boolean };

type Source = {
  owner: string;
  permissions: WorldPermissions | null;
  summary: Record<string, AddressWorldPermission[]>;
};

const lower = (addresses: string[]) => addresses.map(address => address.toLowerCase());

/** The World's collaborators: every wallet with a deploy or stream permission but the owner, with both scopes. */
export function getWorldCollaborators({
  owner,
  permissions,
  summary,
}: Source): WorldCollaborator[] {
  if (!permissions) return [];
  const entries = Object.fromEntries(
    Object.entries(summary).map(([address, list]) => [address.toLowerCase(), list]),
  );
  const deployers = lower(permissions.deployment.wallets);
  const streamers =
    permissions.streaming.type === WorldPermissionType.AllowList
      ? lower(permissions.streaming.wallets)
      : [];
  const addresses = [...new Set([...deployers, ...Object.keys(entries), ...streamers])].filter(
    address => address !== owner.toLowerCase(),
  );

  return addresses.map(address => {
    const deployment = entries[address]?.find(entry => entry.permission === 'deployment');
    const deploy: DeployScope = deployment
      ? deployment.worldWide
        ? { kind: 'all' }
        : { kind: 'parcels', count: deployment.parcelCount ?? 0 }
      : deployers.includes(address)
        ? { kind: 'all' }
        : { kind: 'none' };
    return { address, deploy, stream: streamers.includes(address) };
  });
}

/** Which remove confirm a selection takes: one row, every row, or several. */
export function removalKind(count: number, total: number): 'one' | 'several' | 'all' {
  if (count === 1) return 'one';
  return count === total ? 'all' : 'several';
}

/** Whether anyone may stream into the World: its streaming permission is unrestricted, not an allow-list. */
export function isStreamOpen(permissions: WorldPermissions | null) {
  return permissions?.streaming.type === WorldPermissionType.Unrestricted;
}
