import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { analytics, misc } from '#preload';
import { useDispatch, useSelector } from '#store';
import { t } from '/@/modules/store/translation/utils';
import {
  actions as managementActions,
  selectors as managementSelectors,
} from '/@/modules/store/management';
import { fetchENSList } from '/@/modules/store/ens';
import { useAuth } from '/@/hooks/useAuth';
import type { Land } from '/@/lib/land';
import type { FilterBy, ManagedProject, ManageTab, SortBy } from '/shared/types/manage';
import { getLandName } from '/@/modules/store/management/utils';
import { Navbar, NavbarItem } from '../Navbar';
import { Loader } from '../Loader';
import { Container } from '../Container';
import { TransferLandModal } from '../Modals/TransferLandModal';
import { ManagedProjectsList } from './ManagedProjectsList';
import { LandProjectsList } from './LandProjectsList';
import { EmptyState } from './EmptyState';
import { SpaceUsed } from './SpaceUsed';
import { getManageTabId, MANAGE_PANEL_ID, ManageViewBar } from './ViewBar';
import { CLAIM_NAME_URL, getEmptyKind, getManageEmptyState } from './manageEmptyState';
import { Content, Page, Panel, Title } from './component.styled';

const LANDS_MARKETPLACE_URL = 'https://decentraland.org/marketplace/lands';

export function ManagePage() {
  const { isSignedIn, isSigningIn, signIn, wallet } = useAuth();
  const { data: ens } = useSelector(state => state.ens);
  const { tab, status, projects, total, page, sortBy, searchQuery, publishFilter, lands } =
    useSelector(state => state.management);
  const worldProjects = useSelector(managementSelectors.getWorldProjects);
  const landProjects = useSelector(managementSelectors.getLandProjects);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const titleId = useId();
  const landData = useSelector(state => state.land.data);
  const [transfer, setTransfer] = useState<{
    project: ManagedProject;
    land: Land;
    open: boolean;
  } | null>(null);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const transferOpenerGone =
    !!transfer && !landProjects.some(project => project.id === transfer.project.id);

  useEffect(() => {
    if (transfer && !transfer.open && transferOpenerGone) headingRef.current?.focus();
  }, [transfer?.open]);

  const openTransfer = (project: ManagedProject) => {
    const land = landData.find(item => item.id === project.id);
    if (land) setTransfer({ project, land, open: true });
  };

  useEffect(() => {
    if (wallet) {
      dispatch(fetchENSList({ address: wallet }));
    }
  }, [wallet, dispatch]);

  useEffect(() => {
    if (isSignedIn && tab === 'lands' && lands.status === 'idle') {
      dispatch(managementActions.fetchLandProjects());
    }
  }, [isSignedIn, tab, lands.status, dispatch]);

  const refetchWorlds = useCallback(() => {
    dispatch(managementActions.fetchManagedProjectsFiltered());
  }, [dispatch]);

  const handleTabChange = useCallback(
    (next: ManageTab) => dispatch(managementActions.setTab(next)),
    [dispatch],
  );

  const handleViewChange = useCallback(
    (view: FilterBy | undefined) => {
      dispatch(managementActions.setPublishFilter(view));
      refetchWorlds();
    },
    [refetchWorlds],
  );

  const handleSortChange = useCallback(
    (next: SortBy) => {
      dispatch(managementActions.setSortBy(next));
      refetchWorlds();
    },
    [refetchWorlds],
  );

  const handleSearch = useCallback(
    (query: string) => {
      dispatch(managementActions.setSearchQuery(query));
      refetchWorlds();
    },
    [refetchWorlds],
  );

  const handleLoadMoreProjects = useCallback(() => {
    dispatch(managementActions.setPage(page + 1));
    refetchWorlds();
  }, [page, refetchWorlds]);

  const handleViewScenes = useCallback(() => {
    navigate('/scenes');
  }, [navigate]);

  const emptyActions = {
    onMintName: () => {
      analytics.track('Manage Worlds External Action', { action: 'Mint NAME' });
      void misc.openExternal(CLAIM_NAME_URL);
    },
    onRentOrBuyLand: () => void misc.openExternal(LANDS_MARKETPLACE_URL),
    onViewScenes: handleViewScenes,
    onRetry: () =>
      tab === 'lands'
        ? dispatch(managementActions.fetchLandProjects())
        : dispatch(managementActions.fetchManagedProjectsFiltered({ resetPage: true })),
  };

  const isWorlds = tab === 'worlds';
  const items = isWorlds ? worldProjects : landProjects;
  const listStatus = isWorlds ? status : lands.status;
  const isLoading = listStatus === 'idle' || listStatus === 'loading';
  const emptyKind = getEmptyKind({
    failed: listStatus === 'failed',
    count: items.length,
    hasAny: isWorlds ? Object.keys(ens).length > 0 : lands.projects.length > 0,
    searchQuery,
    view: publishFilter,
  });

  const renderList = () => {
    if (isLoading && !items.length) return <Loader size={70} />;
    if (emptyKind) {
      return (
        <EmptyState
          {...getManageEmptyState({ tab, kind: emptyKind, view: publishFilter }, emptyActions)}
        />
      );
    }
    return isWorlds ? (
      <ManagedProjectsList
        projects={worldProjects}
        hasMore={projects.length < total}
        isLoading={isLoading}
        onLoadMore={handleLoadMoreProjects}
      />
    ) : (
      <LandProjectsList
        projects={landProjects}
        onViewScenes={handleViewScenes}
        onTransfer={openTransfer}
      />
    );
  };

  return (
    <Page className="ManagePage">
      <Navbar active={NavbarItem.MANAGE} />
      <Container>
        <Content>
          <Title
            id={titleId}
            ref={headingRef}
            tabIndex={-1}
            variant="h3"
            component="h1"
          >
            {t('manage.header.title')}
          </Title>
          {!isSignedIn && !isSigningIn ? (
            <EmptyState
              icon="wave"
              title={t('manage.sign_in.title')}
              description={t('manage.sign_in.description')}
              action={{ label: t('manage.sign_in.action'), variant: 'tertiary', onClick: signIn }}
            />
          ) : (
            <>
              <ManageViewBar
                labelledBy={titleId}
                tab={tab}
                view={publishFilter}
                sortBy={sortBy}
                searchQuery={searchQuery}
                onTabChange={handleTabChange}
                onViewChange={handleViewChange}
                onSortChange={handleSortChange}
                onSearch={handleSearch}
              />
              {isWorlds && emptyKind !== 'none' && <SpaceUsed />}
              <Panel
                role="tabpanel"
                id={MANAGE_PANEL_ID}
                aria-labelledby={getManageTabId(tab)}
              >
                {renderList()}
              </Panel>
            </>
          )}
        </Content>
      </Container>
      {transfer && (
        <TransferLandModal
          key={transfer.project.id}
          open={transfer.open}
          land={transfer.land}
          name={getLandName(transfer.project)}
          onClose={() => setTransfer({ ...transfer, open: false })}
        />
      )}
    </Page>
  );
}
