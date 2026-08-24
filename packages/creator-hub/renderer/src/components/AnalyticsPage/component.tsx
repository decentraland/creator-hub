import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, MenuItem, type SelectChangeEvent, Typography } from 'decentraland-ui2';

import { SortBy } from '/shared/types/place-analytics';

import { useDispatch, useSelector } from '#store';
import { t } from '/@/modules/store/translation/utils';
import { actions as placeAnalyticsActions, selectors } from '/@/modules/store/placeAnalytics';
import { fetchENSList } from '/@/modules/store/ens';
import { useAuth } from '/@/hooks/useAuth';

import emptyAnalytics from '/assets/images/analytics-empty.svg';

import { Container } from '../Container';
import { FiltersBar } from '../FiltersBar';
import { Loader } from '../Loader';
import { Navbar, NavbarItem } from '../Navbar';
import { Search } from '../Search';
import { Select } from '../Select';

import { PlacesTable } from './PlacesTable';
import { formatExportDate } from './utils';

import './styles.css';

const SORT_OPTIONS: Array<{ label: string; value: SortBy }> = [
  { label: t('analytics.list.sort.name_asc'), value: SortBy.NAME_ASC },
  { label: t('analytics.list.sort.name_desc'), value: SortBy.NAME_DESC },
  { label: t('analytics.list.sort.most_visits'), value: SortBy.MOST_VISITS },
];

export function AnalyticsPage() {
  const { isSignedIn, wallet } = useAuth();
  const { places, pinnedPlaceIds, sortBy, searchQuery, exportedAt, status, error } = useSelector(
    state => state.placeAnalytics,
  );
  const visiblePlaces = useSelector(selectors.getVisiblePlaces);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const isLoading = status === 'loading' || status === 'idle';

  useEffect(() => {
    if (isSignedIn) dispatch(placeAnalyticsActions.fetchAnalytics());
  }, [isSignedIn]);

  // Names can change outside the app (a purchase, a granted deploy permission), so the
  // sign-in-time fetch goes stale. Refresh in the background on every visit to this tab.
  useEffect(() => {
    if (wallet) {
      dispatch(fetchENSList({ address: wallet }));
    }
  }, [wallet, dispatch]);

  const handleSortChange = useCallback((e: SelectChangeEvent<SortBy>) => {
    dispatch(placeAnalyticsActions.setSortBy(e.target.value as SortBy));
  }, []);

  const handleSearch = useCallback((value: string) => {
    dispatch(placeAnalyticsActions.setSearchQuery(value));
  }, []);

  const handleTogglePin = useCallback((placeId: string) => {
    dispatch(placeAnalyticsActions.togglePinnedPlace(placeId));
  }, []);

  const handleSelectPlace = useCallback(
    (placeId: string) => navigate(`/analytics/${placeId}`),
    [navigate],
  );

  return (
    <main className="AnalyticsPage">
      <Navbar active={NavbarItem.ANALYTICS} />
      <Container>
        <Typography variant="h3">{t('analytics.header.title')}</Typography>
        {isLoading ? (
          <Loader size={70} />
        ) : status === 'failed' ? (
          /* Without this a failed request reads as "you have no Places yet". */
          <Box className="EmptyContainer">
            <Typography variant="h5">{t('analytics.error.title')}</Typography>
            <Typography variant="body1">{error}</Typography>
          </Box>
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
                {/* The export's own stamp: an "as of" date is a different answer from silence. */}
                {exportedAt && (
                  <Typography
                    variant="body2"
                    className="ExportedAt"
                  >
                    {t('analytics.exported_at', { date: formatExportDate(exportedAt) })}
                  </Typography>
                )}
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
                onSelectPlace={handleSelectPlace}
              />
            )}
          </>
        )}
      </Container>
    </main>
  );
}
