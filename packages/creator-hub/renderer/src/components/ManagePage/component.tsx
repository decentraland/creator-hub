import { useCallback, useMemo } from 'react';
import type { SelectChangeEvent } from 'decentraland-ui2';
import { Box, MenuItem, Typography } from 'decentraland-ui2';
import { t } from '/@/modules/store/translation/utils';
import { actions as managementActions } from '/@/modules/store/management';
import { useDispatch, useSelector } from '#store';
import { SortBy } from '/shared/types/manage';
import { Navbar, NavbarItem } from '../Navbar';
import { Loader } from '../Loader';
import { Container } from '../Container';
import { FiltersBar } from '../FiltersBar';
import { Select } from '../Select';
import { Search } from '../Search';
import { Row } from '../Row';
import { Column } from '../Column';
import { ManagedProjectsList } from './ManagedProjectsList';
import { filterProjectsBy, sortProjectsBy } from './utils';
import './styles.css';

/// TODO: Add the other languages translations
/// TODO: handle not signed in state

const SORT_OPTIONS: Array<{ label: string; value: SortBy }> = [
  {
    label: t('manage.sort.latest'),
    value: SortBy.LATEST,
  },
]; /// TODO: add other sort options

export function ManagePage() {
  const { status, projects, sortBy, searchQuery } = useSelector(state => state.management);
  const dispatch = useDispatch();

  const isLoading = status === 'idle' || status === 'loading';

  const projectsToShow = useMemo(() => {
    const filteredProjects = filterProjectsBy(projects, searchQuery);
    return sortProjectsBy(filteredProjects, sortBy);
  }, [sortBy, searchQuery, projects]);

  const handleDropdownChange = useCallback(
    (e: SelectChangeEvent<SortBy>) => {
      dispatch(managementActions.setSortBy(e.target.value as SortBy));
    },
    [dispatch],
  );

  const handleSearch = useCallback(
    (value: string) => {
      dispatch(managementActions.setSearchQuery(value));
    },
    [dispatch],
  );

  return (
    <main className="ManagePage">
      <Navbar active={NavbarItem.MANAGE} />
      <Container>
        <Typography variant="h3">{t('manage.header.title')}</Typography>
        {isLoading ? (
          <Loader size={70} />
        ) : (
          <Row>
            <Column className="ContentColumn">
              <FiltersBar className="FiltersBar">
                <Typography variant="h6">
                  {t('manage.items', { count: projects.length })}
                </Typography>
                <>
                  <Typography>{t('manage.sort_by')}</Typography>
                  <Select
                    variant="standard"
                    value={sortBy}
                    onChange={handleDropdownChange}
                    disabled={!projects?.length}
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
                    disabled={!projects?.length}
                    onChange={handleSearch}
                  />
                </>
              </FiltersBar>
              {projectsToShow.length === 0 ? (
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
                <ManagedProjectsList projects={projectsToShow} />
              )}
            </Column>
          </Row>
        )}
      </Container>
    </main>
  );
}
