import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';

import { useDispatch, useSelector } from '#store';
import { useAuth } from '/@/hooks/useAuth';
import { useSnackbar } from '/@/hooks/useSnackbar';
import type { Land } from '/@/lib/land';
import { actions as managementActions } from '/@/modules/store/management';
import { getLandName } from '/@/modules/store/management/utils';
import { t } from '/@/modules/store/translation/utils';

import { DetailMissing, DetailPage, DetailShell } from '../DetailShell';
import { Dropdown } from '../Dropdown';
import { Loader } from '../Loader';
import { getLandMenuOptions } from '../ManagePage/LandProjectsList/landMenu';
import { getRoleTag } from '../ManagePage/RoleTag';
import { TransferLandModal } from '../Modals/TransferLandModal';
import { CollaboratorsTab } from './CollaboratorsTab';
import { DetailsTab } from './DetailsTab';
import { getLandPermissions, type LandTab } from './landPermissions';
import { ManagersTab } from './ManagersTab';
import { ScenesTab } from './ScenesTab';

export function LandDetailPage() {
  const { id = '', tab = 'details' } = useParams();
  const dispatch = useDispatch();
  const { isSignedIn, isSigningIn } = useAuth();
  const { pushGeneric } = useSnackbar();
  const land = useSelector(state => state.land.data.find(item => item.id === id));
  const project = useSelector(state =>
    state.management.lands.projects.find(item => item.id === id),
  );
  const status = useSelector(state => state.management.lands.status);
  const [transfer, setTransfer] = useState<{ open: boolean; land: Land; name: string } | null>(
    null,
  );

  useEffect(() => {
    if (isSignedIn && status === 'idle') dispatch(managementActions.fetchLandProjects());
  }, [isSignedIn, status, dispatch]);

  if (!isSignedIn && !isSigningIn)
    return (
      <Navigate
        to="/manage"
        replace
      />
    );

  const loading = status === 'idle' || status === 'loading';

  const page = (() => {
    if (!land || !project) {
      if (loading) return <Loader size={70} />;
      return <DetailMissing message={t('land_detail.not_found')} />;
    }

    const permissions = getLandPermissions(land.role);
    const activeTab: LandTab = permissions.tabs.includes(tab as LandTab)
      ? (tab as LandTab)
      : 'details';
    const name = getLandName(project);

    return (
      <DetailShell
        title={t('land_detail.title', { name })}
        basePath={`/manage/land/${encodeURIComponent(id)}`}
        people={
          permissions.roleRow
            ? { kind: 'other', role: getRoleTag(land.role), owner: land.owner }
            : undefined
        }
        menu={
          <Dropdown
            label={t('menu.options_for', { name })}
            variant="filled"
            options={getLandMenuOptions(project, {
              onTransfer: () => setTransfer({ open: true, land, name }),
              onUrlCopied: () => pushGeneric('success', t('snackbar.generic.url_copied')),
            })}
          />
        }
        tabs={permissions.tabs.map(value => ({ value, label: t(`land_detail.tabs.${value}`) }))}
        activeTab={activeTab}
      >
        {activeTab === 'details' && (
          <DetailsTab
            land={land}
            project={project}
            mode={permissions.editDetails ? 'edit' : 'read'}
          />
        )}
        {activeTab === 'scenes' && (
          <ScenesTab
            land={land}
            project={project}
            mode={permissions.unpublish ? 'manage' : 'view'}
          />
        )}
        {activeTab === 'collaborators' && (
          <CollaboratorsTab
            land={land}
            landName={name}
          />
        )}
        {activeTab === 'managers' && <ManagersTab />}
      </DetailShell>
    );
  })();

  return (
    <DetailPage>
      {page}
      {transfer && (
        <TransferLandModal
          open={transfer.open}
          land={transfer.land}
          name={transfer.name}
          onClose={() => setTransfer({ ...transfer, open: false })}
        />
      )}
    </DetailPage>
  );
}
