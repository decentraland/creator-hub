import { type SyntheticEvent, useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DownloadIcon from '@mui/icons-material/FileDownloadOutlined';
import {
  Box,
  Button,
  MenuItem,
  type SelectChangeEvent,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from 'decentraland-ui2';

import { DateRange } from '/shared/types/place-analytics';

import { useDispatch, useSelector } from '#store';
import { t } from '/@/modules/store/translation/utils';
import type { PlaceScopedState } from '/@/modules/store/placeAnalytics';
import { actions as placeAnalyticsActions } from '/@/modules/store/placeAnalytics';
import { useAuth } from '/@/hooks/useAuth';

import { Container } from '../Container';
import { Loader } from '../Loader';
import { Navbar, NavbarItem } from '../Navbar';
import { Select } from '../Select';
import { Title } from '../Title';

import { OverviewTab } from './OverviewTab';
import { PlaceCard } from './PlaceCard';
import { RetentionTab } from './RetentionTab';
import { VisitsTab } from './VisitsTab';

import './styles.css';

const DATE_RANGE_OPTIONS: Array<{ label: string; value: DateRange }> = [
  { label: t('analytics.detail.date_range.last_7_days'), value: DateRange.LAST_7_DAYS },
  { label: t('analytics.detail.date_range.last_30_days'), value: DateRange.LAST_30_DAYS },
  { label: t('analytics.detail.date_range.last_60_days'), value: DateRange.LAST_60_DAYS },
];

/** Engagement is not built yet, but is shown so the page reads honestly. */
const TABS = [
  { value: 'overview', label: t('analytics.detail.tabs.overview'), enabled: true },
  { value: 'retention', label: t('analytics.detail.tabs.retention'), enabled: true },
  { value: 'visits', label: t('analytics.detail.tabs.visits'), enabled: true },
  { value: 'engagement', label: t('analytics.detail.tabs.engagement'), enabled: false },
];

type TabValue = 'overview' | 'retention' | 'visits';

/** Renders a tab's data once it has loaded, or its loading and error states. */
function TabContent<T>({
  state,
  children,
}: {
  state: PlaceScopedState<T>;
  children: (data: T) => JSX.Element;
}) {
  if (state.status === 'idle' || state.status === 'loading') return <Loader size={70} />;
  if (state.status === 'failed' || !state.data) {
    return (
      <Box className="ErrorContainer">
        <Typography variant="h5">{t('analytics.detail.error.title')}</Typography>
        <Typography variant="body1">{state.error}</Typography>
      </Box>
    );
  }
  return children(state.data);
}

export function AnalyticsDetailPage() {
  const { placeId } = useParams<{ placeId: string }>();
  const { isSignedIn } = useAuth();
  const { detail, retention, visits, dateRange } = useSelector(state => state.placeAnalytics);
  const [tab, setTab] = useState<TabValue>('overview');
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const isLoading = detail.status === 'idle' || detail.status === 'loading';

  useEffect(() => {
    if (isSignedIn && placeId) {
      dispatch(placeAnalyticsActions.fetchPlaceDetail({ placeId }));
    }
  }, [isSignedIn, placeId, dateRange]);

  // Each tab's data is fetched the first time it is opened, and on range changes.
  useEffect(() => {
    if (!isSignedIn || !placeId) return;
    if (tab === 'retention') dispatch(placeAnalyticsActions.fetchPlaceRetention({ placeId }));
    if (tab === 'visits') dispatch(placeAnalyticsActions.fetchPlaceVisits({ placeId }));
  }, [isSignedIn, placeId, tab, dateRange]);

  useEffect(() => () => void dispatch(placeAnalyticsActions.clearDetail()), []);

  const handleBack = useCallback(() => navigate('/analytics'), [navigate]);

  const handleTabChange = useCallback((_e: SyntheticEvent, value: TabValue) => {
    setTab(value);
  }, []);

  const handleDateRangeChange = useCallback((e: SelectChangeEvent<DateRange>) => {
    dispatch(placeAnalyticsActions.setDateRange(e.target.value as DateRange));
  }, []);

  const title = detail.data
    ? t('analytics.detail.title', { name: detail.data.place.name })
    : t('analytics.header.title');

  return (
    <main className="AnalyticsDetailPage">
      <Navbar active={NavbarItem.ANALYTICS} />
      <Container>
        <Box className="Header">
          <Title
            value={title}
            onBack={handleBack}
          />
          {/* Enabled once there is an analytics API to export from. */}
          <Tooltip title={t('analytics.actions.export_unavailable')}>
            <span>
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<DownloadIcon />}
                disabled
              >
                {t('analytics.actions.export')}
              </Button>
            </span>
          </Tooltip>
        </Box>
        {isLoading ? (
          <Loader size={70} />
        ) : detail.status === 'failed' || !detail.data ? (
          <Box className="ErrorContainer">
            <Typography variant="h5">{t('analytics.detail.error.title')}</Typography>
            <Typography variant="body1">{detail.error}</Typography>
          </Box>
        ) : (
          <Box className="Content">
            <PlaceCard place={detail.data.place} />
            <Box className="Metrics">
              <Box className="TabsBar">
                <Tabs
                  value={tab}
                  onChange={handleTabChange}
                >
                  {TABS.map(option => (
                    <Tab
                      key={option.value}
                      value={option.value}
                      label={option.label}
                      disabled={!option.enabled}
                    />
                  ))}
                </Tabs>
                <Box className="DateRange">
                  <Typography variant="body1">{t('analytics.detail.date_range.title')}</Typography>
                  <Select
                    value={dateRange}
                    onChange={handleDateRangeChange}
                  >
                    {DATE_RANGE_OPTIONS.map(option => (
                      <MenuItem
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </Box>
              </Box>
              {tab === 'overview' && <OverviewTab overview={detail.data.overview} />}
              {tab === 'retention' && (
                <TabContent state={retention}>
                  {data => <RetentionTab retention={data} />}
                </TabContent>
              )}
              {tab === 'visits' && (
                <TabContent state={visits}>{data => <VisitsTab visits={data} />}</TabContent>
              )}
            </Box>
          </Box>
        )}
      </Container>
    </main>
  );
}
