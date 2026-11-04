import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';

import { useDispatch, useSelector } from '#store';
import { useAuth } from '/@/hooks/useAuth';
import { useSnackbar } from '/@/hooks/useSnackbar';
import { Worlds } from '/@/lib/worlds';
import { actions as managementActions } from '/@/modules/store/management';
import { resolveWorldProject } from '/@/modules/store/management/utils';
import { t } from '/@/modules/store/translation/utils';
import type { ManagedProject } from '/shared/types/manage';

import { DetailMissing, DetailPage, DetailShell, type HeaderPeople } from '../DetailShell';
import { Dropdown } from '../Dropdown';
import { Loader } from '../Loader';
import { UnpublishWorldModal } from '../ManagePage/ManagedProjectsList/UnpublishWorldModal';
import { getWorldMenuOptions } from '../ManagePage/ManagedProjectsList/worldMenu';
import { getRoleTag } from '../ManagePage/RoleTag';
import { CollaboratorsTab } from './CollaboratorsTab';
import { DetailsTab } from './DetailsTab';
import { ScenesTab } from './ScenesTab';
import { SettingsTab } from './SettingsTab';
import { useDeployScope } from './useDeployScope';
import { getWorldPermissions, type WorldTab } from './worldPermissions';

export function WorldDetailPage() {
  const { name = '', tab } = useParams();
  const dispatch = useDispatch();
  const { isSignedIn, isSigningIn, wallet } = useAuth();
  const { pushGeneric } = useSnackbar();
  const listed = useSelector(state =>
    [...state.management.projects, ...state.management.emptyProjects].find(
      item => item.id === name,
    ),
  );
  const ens = useSelector(state => state.ens.data[name]);
  const status = useSelector(state => state.management.status);
  const [unpublishing, setUnpublishing] = useState<string | null>(null);
  const [resolved, setResolved] = useState<ManagedProject | null>(null);
  const [resolutionFailure, setResolutionFailure] = useState<string | null>(null);
  const loading = status === 'idle' || status === 'loading';
  const project = listed ?? (resolved?.id === name ? resolved : undefined);
  const deployScope = useDeployScope(project, wallet);

  useEffect(() => {
    if (listed) setResolved(listed);
  }, [listed]);

  useEffect(() => setResolutionFailure(null), [name]);

  useEffect(() => {
    if (isSignedIn && wallet && status === 'idle')
      dispatch(managementActions.fetchAllManagedProjectsData({ address: wallet }));
  }, [isSignedIn, wallet, status, dispatch]);

  useEffect(() => {
    if (project || loading || !ens || !wallet || resolutionFailure === name) return;
    let current = true;
    void resolveWorldProject(new Worlds(), ens, wallet)
      .then(found => {
        if (current) setResolved(found);
      })
      .catch(() => {
        if (current) setResolutionFailure(name);
      });
    return () => {
      current = false;
    };
  }, [project, loading, ens, wallet, resolutionFailure, name]);

  if (!isSignedIn && !isSigningIn)
    return (
      <Navigate
        to="/manage"
        replace
      />
    );

  const permissions =
    project && deployScope !== 'loading' && getWorldPermissions(project, deployScope);

  const page = (() => {
    if (!project && (loading || (ens && resolutionFailure !== name))) return <Loader size={70} />;
    if (project && deployScope === 'loading') return <Loader size={70} />;
    if (!project || !permissions) return <DetailMissing message={t('world_detail.not_found')} />;

    const activeTab: WorldTab = permissions.tabs.includes(tab as WorldTab)
      ? (tab as WorldTab)
      : permissions.tabs[0];
    const title = project.title || project.id;
    const people: HeaderPeople =
      permissions.header === 'owner'
        ? { kind: 'self', owner: wallet ?? '' }
        : { kind: 'other', role: getRoleTag(project.role), owner: project.owner ?? '' };

    return (
      <DetailShell
        title={t('land_detail.title', { name: title })}
        basePath={`/manage/world/${encodeURIComponent(project.id)}`}
        people={people}
        menu={
          <Dropdown
            label={t('menu.options_for', { name: title })}
            variant="filled"
            options={getWorldMenuOptions(project, {
              onUnpublishWorld: () => setUnpublishing(project.id),
              onUrlCopied: () => pushGeneric('success', t('snackbar.generic.url_copied')),
            })}
          />
        }
        tabs={permissions.tabs.map(value => ({ value, label: t(`world_detail.tabs.${value}`) }))}
        activeTab={activeTab}
      >
        {activeTab === 'details' && <DetailsTab worldName={project.id} />}
        {activeTab === 'settings' && (
          <SettingsTab
            worldName={project.id}
            access={permissions.access}
          />
        )}
        {activeTab === 'collaborators' && <CollaboratorsTab worldName={project.id} />}
        {activeTab === 'scenes' && (
          <ScenesTab
            worldName={project.id}
            mode={permissions.scenes}
          />
        )}
      </DetailShell>
    );
  })();

  return (
    <DetailPage>
      {page}
      <UnpublishWorldModal
        worldName={unpublishing}
        onClose={() => setUnpublishing(null)}
      />
    </DetailPage>
  );
}
