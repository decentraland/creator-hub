import { useEffect, useId, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Tab } from 'decentraland-ui2';

import { useDispatch, useSelector } from '#store';
import { useAuth } from '/@/hooks/useAuth';
import { useSnackbar } from '/@/hooks/useSnackbar';
import type { Land } from '/@/lib/land';
import { actions as managementActions } from '/@/modules/store/management';
import { getLandName } from '/@/modules/store/management/utils';
import { t } from '/@/modules/store/translation/utils';

import { Container } from '../Container';
import { Dropdown } from '../Dropdown';
import { Loader } from '../Loader';
import { EmptyState } from '../ManagePage/EmptyState';
import { getLandMenuOptions } from '../ManagePage/LandProjectsList/landMenu';
import { getRoleTag, RoleTag } from '../ManagePage/RoleTag';
import { TransferLandModal } from '../Modals/TransferLandModal';
import { WorldPermissionsAvatarWithInfo } from '../Modals/WorldPermissionsModal/WorldPermissionsAvatarWithInfo';
import { Navbar, NavbarItem } from '../Navbar';
import { Title } from '../Title';
import { CollaboratorsTab } from './CollaboratorsTab';
import { DetailsTab } from './DetailsTab';
import { getLandPermissions, type LandTab } from './landPermissions';
import { ManagersTab } from './ManagersTab';
import { ScenesTab } from './ScenesTab';
import {
  Content,
  Header,
  HeaderActions,
  Page,
  RoleRow,
  TabBar,
  TitleBlock,
} from './LandDetailPage.styled';

const PANEL_ID = 'land-detail-panel';

export function LandDetailPage() {
  const { id = '', tab = 'details' } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isSignedIn, isSigningIn } = useAuth();
  const { pushGeneric } = useSnackbar();
  const land = useSelector(state => state.land.data.find(item => item.id === id));
  const project = useSelector(state =>
    state.management.lands.projects.find(item => item.id === id),
  );
  const status = useSelector(state => state.management.lands.status);
  const titleId = useId();
  const [actionsSlot, setActionsSlot] = useState<HTMLDivElement | null>(null);
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

  const backToManage = () => navigate('/manage');
  const loading = status === 'idle' || status === 'loading';

  const page = (() => {
    if (!land || !project) {
      if (loading) return <Loader size={70} />;
      return (
        <EmptyState
          title={t('land_detail.not_found')}
          action={{
            label: t('land_detail.back_to_manage'),
            variant: 'secondary',
            onClick: backToManage,
          }}
        />
      );
    }

    const permissions = getLandPermissions(land.role);
    const activeTab: LandTab = permissions.tabs.includes(tab as LandTab)
      ? (tab as LandTab)
      : 'details';
    const name = getLandName(project);
    const roleTag = getRoleTag(land.role);

    return (
      <>
        <Header>
          <TitleBlock>
            <Title
              id={titleId}
              value={t('land_detail.title', { name })}
              onBack={backToManage}
            />
            {permissions.roleRow && (
              <RoleRow>
                <div>
                  <dt>{t('land_detail.role')}</dt>
                  <dd>{roleTag && <RoleTag variant={roleTag} />}</dd>
                </div>
                <div>
                  <dt>{t('land_detail.owner')}</dt>
                  <dd>
                    <WorldPermissionsAvatarWithInfo
                      value={land.owner}
                      size="tiny"
                    />
                  </dd>
                </div>
              </RoleRow>
            )}
          </TitleBlock>
          <HeaderActions>
            <div ref={setActionsSlot} />
            <Dropdown
              label={t('menu.options_for', { name })}
              variant="filled"
              options={getLandMenuOptions(project, {
                onTransfer: () => setTransfer({ open: true, land, name }),
                onUrlCopied: () => pushGeneric('success', t('snackbar.generic.url_copied')),
              })}
            />
          </HeaderActions>
        </Header>
        <TabBar
          value={activeTab}
          aria-labelledby={titleId}
          onChange={(_, next: LandTab) =>
            navigate(`/manage/land/${encodeURIComponent(id)}/${next}`, { replace: true })
          }
        >
          {permissions.tabs.map(value => (
            <Tab
              key={value}
              value={value}
              label={t(`land_detail.tabs.${value}`)}
              aria-controls={PANEL_ID}
            />
          ))}
        </TabBar>
        <div
          role="tabpanel"
          id={PANEL_ID}
        >
          {activeTab === 'details' && (
            <DetailsTab
              land={land}
              project={project}
              mode={permissions.editDetails ? 'edit' : 'read'}
              actionsSlot={actionsSlot}
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
        </div>
      </>
    );
  })();

  return (
    <Page className="LandDetailPage">
      <Navbar active={NavbarItem.MANAGE} />
      <Container>
        <Content>{page}</Content>
      </Container>
      {transfer && (
        <TransferLandModal
          open={transfer.open}
          land={transfer.land}
          name={transfer.name}
          onClose={() => setTransfer({ ...transfer, open: false })}
        />
      )}
    </Page>
  );
}
