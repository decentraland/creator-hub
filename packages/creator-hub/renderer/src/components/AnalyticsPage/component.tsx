import { useCallback, useEffect } from 'react';
import { Box, MenuItem, type SelectChangeEvent, Typography } from 'decentraland-ui2';

import { SortBy } from '/shared/types/place-analytics';

import { useDispatch, useSelector } from '#store';
import { t } from '/@/modules/store/translation/utils';
import { actions as placeAnalyticsActions, selectors } from '/@/modules/store/placeAnalytics';
import { useAuth } from '/@/hooks/useAuth';

import emptyAnalytics from '/assets/images/analytics-empty.svg';

import { Container } from '../Container';
import { FiltersBar } from '../FiltersBar';
import { Loader } from '../Loader';
import { Navbar, NavbarItem } from '../Navbar';
import { Search } from '../Search';
import { Select } from '../Select';

import { PlacesTable } from './PlacesTable';

import './styles.css';

const SORT_OPTIONS: Array<{ label: string; value: SortBy }> = [
  { label: t('analytics.list.sort.name_asc'), value: SortBy.NAME_ASC },
  { label: t('analytics.list.sort.name_desc'), value: SortBy.NAME_DESC },
  { label: t('analytics.list.sort.most_visits'), value: SortBy.MOST_VISITS },
];

export function AnalyticsPage() {
  const { isSignedIn } = useAuth();
  const { places, pinnedPlaceIds, sortBy, searchQuery, status } = useSelector(
    state => state.placeAnalytics,
  );
  const visiblePlaces = useSelector(selectors.getVisiblePlaces);
  const dispatch = useDispatch();

  const isLoading = status === 'loading';

  useEffect(() => {
    if (isSignedIn) dispatch(placeAnalyticsActions.fetchPlaces());
  }, [isSignedIn]);

  const handleSortChange = useCallback((e: SelectChangeEvent<SortBy>) => {
    dispatch(placeAnalyticsActions.setSortBy(e.target.value as SortBy));
  }, []);

  const handleSearch = useCallback((value: string) => {
    dispatch(placeAnalyticsActions.setSearchQuery(value));
  }, []);

  const handleTogglePin = useCallback((placeId: string) => {
    dispatch(placeAnalyticsActions.togglePinnedPlace(placeId));
  }, []);

  return (
    <main className="AnalyticsPage">
      <Navbar active={NavbarItem.ANALYTICS} />
      <Container>
        <Typography variant="h3">{t('analytics.header.title')}</Typography>
        {isLoading ? (
          <Loader size={70} />
        ) : places.length === 0 ? (
          <Box className="EmptyContainer">
            <img
              src={emptyAnalytics}
              alt=""
            />
            <Typography variant="h5">{t('analytics.empty_list.title')}</Typography>
            <Typography variant="body1">{t('analytics.empty_list.description')}</Typography>
          </Box>
        ) : (
          <>
            <FiltersBar className="FiltersBar">
              <Typography variant="h6">
                {t('analytics.list.places', { count: visiblePlaces.length })}
              </Typography>
              <>
                <Typography variant="body1">{t('analytics.list.sort.title')}</Typography>
                <Select
                  value={sortBy}
                  onChange={handleSortChange}
                >
                  {SORT_OPTIONS.map(option => (
                    <MenuItem
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
                <Search
                  placeholder={t('analytics.list.search')}
                  defaultValue={searchQuery}
                  onChange={handleSearch}
                />
              </>
            </FiltersBar>
            {visiblePlaces.length === 0 ? (
              <Box className="EmptyContainer">
                <Typography variant="h5">{t('analytics.empty_list.search.title')}</Typography>
                <Typography variant="body1">
                  {t('analytics.empty_list.search.description')}
                </Typography>
              </Box>
            ) : (
              <PlacesTable
                places={visiblePlaces}
                pinnedPlaceIds={pinnedPlaceIds}
                onTogglePin={handleTogglePin}
              />
            )}
          </>
        )}
      </Container>
    </main>
  );
}
