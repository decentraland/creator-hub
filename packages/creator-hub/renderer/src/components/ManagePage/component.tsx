import { useCallback } from 'react';
import type { SelectChangeEvent } from 'decentraland-ui2';
import { Box, Chip, MenuItem, Typography } from 'decentraland-ui2';
import { t } from '/@/modules/store/translation/utils';
import { actions as managementActions } from '/@/modules/store/management';
import { useAuth } from '/@/hooks/useAuth';
import { useDispatch, useSelector } from '#store';
import { FilterBy, SortBy } from '/shared/types/manage';
import { Navbar, NavbarItem } from '../Navbar';
import { Loader } from '../Loader';
import { Container } from '../Container';
import { FiltersBar } from '../FiltersBar';
import { Select } from '../Select';
import { Search } from '../Search';
import { Row } from '../Row';
import { Column } from '../Column';
import { ManagedProjectsList } from './ManagedProjectsList';
import { StorageUsed } from './StorageUsed';
import { SignInCard } from './SignInCard';
import './styles.css';

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
  const { isSignedIn, isSigningIn, signIn } = useAuth();
  const { status, projects, total, page, sortBy, searchQuery, publishFilter } = useSelector(
    state => state.management,
  );
  const dispatch = useDispatch();

  const isLoading = status === 'idle' || status === 'loading';

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

  return (
    <main className="ManagePage">
      <Navbar active={NavbarItem.MANAGE} />
      <Container>
        <Typography variant="h3">{t('manage.header.title')}</Typography>
        {!isSignedIn && !isSigningIn ? (
          <SignInCard onClickSignIn={signIn} />
        ) : isLoading ? (
          <Loader size={70} />
        ) : (
          <Row>
            <Column className="ContentColumn">
              <FiltersBar className="FiltersBar">
                <>
                  <Typography variant="h6">
                    {t('manage.items', { count: projects.length })}
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
                          option.value !== publishFilter
                            ? () => handlePublishFilterChange(option.value)
                            : undefined
                        }
                      />
                    ))}
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
              {projects.length === 0 ? (
                <Box className="EmptyContainer">
                  <Typography variant="h6">
                    {searchQuery ? t('manage.empty_search.title') : t('manage.no_projects.title')}
                  </Typography>
                  <Typography variant="body1">
                    {searchQuery
                      ? t('manage.empty_search.description')
                      : t('manage.no_projects.description')}
                  </Typography>
                </Box>
              ) : (
                <ManagedProjectsList
                  projects={projects}
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
