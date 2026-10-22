import { useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import cx from 'classnames';
import RefreshIcon from '@mui/icons-material/Cached';
import PaidIcon from '@mui/icons-material/Paid';
import type { SelectChangeEvent } from 'decentraland-ui2';
import { Box, Chip, IconButton, MenuItem, Typography } from 'decentraland-ui2';
import { analytics, misc } from '#preload';
import { t } from '/@/modules/store/translation/utils';
import { actions as managementActions } from '/@/modules/store/management';
import { fetchENSList } from '/@/modules/store/ens';
import { useAuth } from '/@/hooks/useAuth';
import { useCreatorFund } from '/@/hooks/useCreatorFund';
import { fundKeyOfProject } from '/@/lib/creatorFund';
import { actions as creatorFundActions } from '/@/modules/store/creatorFund';
import { useDispatch, useSelector } from '#store';
import { FilterBy, SortBy } from '/shared/types/manage';
import { Navbar, NavbarItem } from '../Navbar';
import { Loader } from '../Loader';
import { Container } from '../Container';
import { FiltersBar } from '../FiltersBar';
import { Select } from '../Select';
import { Search } from '../Search';
import { Button } from '../Button';
import { Row } from '../Row';
import { Column } from '../Column';
import { ManagedProjectsList } from './ManagedProjectsList';
import { StorageUsed } from './StorageUsed';
import { SignInCard } from './SignInCard';
import './styles.css';

const CLAIM_NAME_URL = 'https://decentraland.org/marketplace/names/claim';

const FILTER_OPTIONS: Array<{ label: string; value: FilterBy }> = [
  {
    label: t('manage.filters.published'),
    value: FilterBy.PUBLISHED,
  },
  {
    label: t('manage.filters.unpublished'),
    value: FilterBy.UNPUBLISHED,
  },
];

const SORT_OPTIONS: Array<{ label: string; value: SortBy }> = [
  {
    label: t('manage.sort.latest'),
    value: SortBy.LATEST,
  },
  {
    label: t('manage.sort.name'),
    value: SortBy.NAME,
  },
];

export function ManagePage() {
  const { isSignedIn, isSigningIn, signIn, wallet } = useAuth();
  const { data: ens } = useSelector(state => state.ens);
  const { status, projects, total, page, sortBy, searchQuery, publishFilter } = useSelector(
    state => state.management,
  );
  const { isEnrolled, showInFundOnly, places: fundPlaces } = useCreatorFund();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const isLoading = status === 'idle' || status === 'loading';
  const showMainLoader = isLoading && !projects.length;

  // Names can change outside the app (a purchase, a granted deploy permission), so the
  // sign-in-time fetch goes stale. Refresh in the background on every visit to this tab.
  useEffect(() => {
    if (wallet) {
      dispatch(fetchENSList({ address: wallet }));
    }
  }, [wallet, dispatch]);

  // Labels for every tile on screen; already-answered places are skipped by the thunk.
  useEffect(() => {
    const deployed = projects.filter(project => project.deployment);
    if (!deployed.length) return;
    dispatch(
      creatorFundActions.fetchPlacesEligibility(
        deployed.map(project => ({
          key: fundKeyOfProject(project),
          title: project.deployment?.title ?? null,
        })),
      ),
    );
  }, [projects, dispatch]);

  /**
   * Narrows the loaded page only. POC: the real filter belongs in the
   * management query, or it cannot see past the current page.
   */
  const visibleProjects = useMemo(
    () =>
      showInFundOnly && publishFilter === FilterBy.PUBLISHED
        ? projects.filter(
            project => isEnrolled && fundPlaces[fundKeyOfProject(project)]?.opt_in.eligible,
          )
        : projects,
    [projects, showInFundOnly, publishFilter, isEnrolled, fundPlaces],
  );

  const isFundFilterEmpty =
    showInFundOnly &&
    publishFilter === FilterBy.PUBLISHED &&
    projects.length > 0 &&
    !visibleProjects.length;

  const handleToggleFundFilter = useCallback(() => {
    dispatch(creatorFundActions.setShowInFundOnly(!showInFundOnly));
  }, [dispatch, showInFundOnly]);

  const handleOpenCreatorFund = useCallback(() => navigate('/payouts'), [navigate]);

  const handleSortDropdownChange = useCallback((e: SelectChangeEvent<SortBy>) => {
    dispatch(managementActions.setSortBy(e.target.value as SortBy));
    dispatch(managementActions.fetchManagedProjectsFiltered());
  }, []);

  const handleSearch = useCallback((value: string) => {
    dispatch(managementActions.setSearchQuery(value));
    dispatch(managementActions.fetchManagedProjectsFiltered());
  }, []);

  const handlePublishFilterChange = useCallback((value: FilterBy) => {
    dispatch(managementActions.setPublishFilter(value));
    dispatch(managementActions.fetchManagedProjectsFiltered());
  }, []);

  const handleLoadMoreProjects = useCallback(() => {
    dispatch(managementActions.setPage(page + 1));
    dispatch(managementActions.fetchManagedProjectsFiltered());
  }, [page]);

  const handleRefreshProjects = useCallback(() => {
    dispatch(managementActions.setPage(0));
    dispatch(managementActions.setSearchQuery(''));
    dispatch(managementActions.fetchManagedProjectsFiltered());
  }, []);

  const handleMintName = useCallback(() => {
    analytics.track('Manage Worlds External Action', { action: 'Mint NAME' });
    misc.openExternal(CLAIM_NAME_URL);
  }, []);

  const handleViewScenes = useCallback(() => {
    navigate('/scenes');
  }, [navigate]);

  const emptyTitle = useMemo(() => {
    if (projects.length) return '';
    if (searchQuery) return t('manage.empty_list.search.title');
    if (!Object.keys(ens).length) return t('manage.empty_list.all.title');
    if (publishFilter === FilterBy.PUBLISHED) return t('manage.empty_list.published.title');
    return t('manage.empty_list.unpublished.title');
  }, [projects.length, searchQuery, publishFilter, ens]);

  const emptySubtitle = useMemo(() => {
    if (projects.length) return '';
    if (searchQuery) return t('manage.empty_list.search.description');
    if (!Object.keys(ens).length) return t('manage.empty_list.all.description');
    if (publishFilter === FilterBy.PUBLISHED) return t('manage.empty_list.published.description');
    return t('manage.empty_list.unpublished.description');
  }, [projects.length, searchQuery, publishFilter, ens]);

  return (
    <main className="ManagePage">
      <Navbar active={NavbarItem.MANAGE} />
      <Container>
        <Box className="ManageHeader">
          <Typography variant="h3">
            {t('manage.header.title')}
            {isSignedIn && (
              <IconButton
                onClick={handleRefreshProjects}
                disabled={isLoading}
                className={cx('RefreshButton', { Loading: isLoading && !showMainLoader })}
              >
                <RefreshIcon />
              </IconButton>
            )}
          </Typography>
          {isSignedIn && (
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<PaidIcon />}
              onClick={handleOpenCreatorFund}
            >
              {t('manage.actions.creator_fund')}
            </Button>
          )}
        </Box>
        {!isSignedIn && !isSigningIn ? (
          <SignInCard onClickSignIn={signIn} />
        ) : (
          <Row>
            <Column className="ContentColumn">
              <FiltersBar className="FiltersBar">
                <>
                  <Typography variant="h6">
                    {t('manage.items', { count: visibleProjects.length })}
                  </Typography>
                  <Box className="FilterChipsContainer">
                    <Typography>{t('manage.filter_by')}</Typography>
                    {FILTER_OPTIONS.map(option => (
                      <Chip
                        key={option.value}
                        label={option.label}
                        variant={option.value === publishFilter ? 'filled' : 'outlined'}
                        className="FilterChip"
                        onClick={
                          option.value !== publishFilter && !isLoading
                            ? () => handlePublishFilterChange(option.value)
                            : undefined
                        }
                      />
                    ))}
                    {publishFilter === FilterBy.PUBLISHED && (
                      <Chip
                        icon={<PaidIcon />}
                        label={t('manage.filters.in_fund')}
                        variant={showInFundOnly ? 'filled' : 'outlined'}
                        className="FilterChip FundFilterChip"
                        aria-pressed={showInFundOnly}
                        onClick={handleToggleFundFilter}
                      />
                    )}
                  </Box>
                </>
                {publishFilter === FilterBy.PUBLISHED && (
                  <>
                    <Typography>{t('manage.sort_by')}</Typography>
                    <Select
                      variant="standard"
                      value={sortBy}
                      onChange={handleSortDropdownChange}
                      disabled={!projects?.length || isLoading}
                    >
                      {SORT_OPTIONS.map(option => (
                        <MenuItem
                          key={option.value}
                          value={option.value}
                          className="sort-item"
                        >
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                    <Search
                      placeholder={t('manage.search')}
                      defaultValue={searchQuery}
                      disabled={!searchQuery && !projects.length}
                      onChange={handleSearch}
                    />
                  </>
                )}
              </FiltersBar>
              {showMainLoader ? (
                <Loader size={70} />
              ) : projects.length === 0 ? (
                <Box className="EmptyContainer">
                  <Typography variant="h6">{emptyTitle}</Typography>
                  <Typography variant="body1">{emptySubtitle}</Typography>
                  {!searchQuery &&
                    (!Object.keys(ens).length || publishFilter === FilterBy.UNPUBLISHED ? (
                      <Button
                        onClick={handleMintName}
                        color="secondary"
                      >
                        {t('manage.actions.mint_name')}
                      </Button>
                    ) : (
                      <Button
                        onClick={handleViewScenes}
                        color="secondary"
                      >
                        {t('manage.actions.view_scenes')}
                      </Button>
                    ))}
                </Box>
              ) : isFundFilterEmpty ? (
                <Box className="EmptyContainer">
                  <Typography variant="h6">{t('manage.empty_list.in_fund.title')}</Typography>
                  <Typography variant="body1">
                    {t('manage.empty_list.in_fund.description')}
                  </Typography>
                  <Button
                    onClick={handleOpenCreatorFund}
                    color="secondary"
                  >
                    {t('manage.actions.creator_fund')}
                  </Button>
                </Box>
              ) : (
                <ManagedProjectsList
                  projects={visibleProjects}
                  total={total}
                  isLoading={isLoading}
                  onLoadMore={handleLoadMoreProjects}
                />
              )}
            </Column>
            <StorageUsed />
          </Row>
        )}
      </Container>
    </main>
  );
}
