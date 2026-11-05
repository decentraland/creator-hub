import { useEffect, useState } from 'react';

import { useDispatch } from '#store';
import { WorldRoleType } from '/@/lib/worlds';
import { fetchWorldPermissions } from '/@/modules/store/management/slice';
import { isWorldWideDeployer } from '/@/modules/store/management/utils';
import type { ManagedProject } from '/shared/types/manage';

import type { DeployScope } from './worldPermissions';

/**
 * How far the account's deploy grant on the World reaches, or `'loading'` while it is read. Owners
 * need no lookup. A failed lookup answers `'parcels'`: the narrower page never offers a save the
 * server would refuse.
 *
 * The answer is kept in local state rather than read from the store, because the Scenes tab refetches
 * the same permissions on mount; following the store's `loading` would unmount the tab and loop.
 */
export function useDeployScope(
  project: ManagedProject | undefined,
  wallet: string | undefined,
): DeployScope | 'loading' {
  const dispatch = useDispatch();
  const worldName =
    project?.role === WorldRoleType.COLLABORATOR && project.access !== 'stream'
      ? project.id
      : undefined;
  const [answer, setAnswer] = useState<{ worldName: string; scope: DeployScope } | null>(null);

  useEffect(() => {
    if (!worldName || !wallet) return;
    let current = true;
    void dispatch(fetchWorldPermissions({ worldName })).then(action => {
      if (!current) return;
      const summary = fetchWorldPermissions.fulfilled.match(action)
        ? action.payload?.summary
        : undefined;
      const worldWide = !!summary && isWorldWideDeployer(summary, wallet);
      setAnswer({ worldName, scope: worldWide ? 'world' : 'parcels' });
    });
    return () => {
      current = false;
    };
  }, [dispatch, worldName, wallet]);

  if (!worldName) return 'parcels';
  return answer?.worldName === worldName ? answer.scope : 'loading';
}
