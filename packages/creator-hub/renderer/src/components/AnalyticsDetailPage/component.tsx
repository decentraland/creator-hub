import { type SyntheticEvent, useCallback, useEffect, useMemo, useState } from 'react';
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

import { MetricsWindow, PlaceAccess } from '/shared/types/place-analytics';

import { useDispatch, useSelector } from '#store';
import { t } from '/@/modules/store/translation/utils';
import { actions as placeAnalyticsActions, selectors } from '/@/modules/store/placeAnalytics';
import {
  hasNoData,
  toEngagement,
  toOverview,
  toRetention,
  toVisits,
} from '/@/lib/placeAnalytics.adapter';
import { useAuth } from '/@/hooks/useAuth';

import { Container } from '../Container';
import { Loader } from '../Loader';
import { Navbar, NavbarItem } from '../Navbar';
import { Select } from '../Select';
import { Title } from '../Title';
import { formatExportDate } from '../AnalyticsPage/utils';

import { OverviewTab } from './OverviewTab';
import { PlaceCard } from './PlaceCard';
import { EngagementTab } from './EngagementTab';
import { RetentionTab } from './RetentionTab';
import { VisitsTab } from './VisitsTab';

import './styles.css';

const WINDOW_OPTIONS: Array<{ label: string; value: MetricsWindow }> = [
  { label: t('analytics.detail.window.last_30_days'), value: MetricsWindow.LAST_30_DAYS },
  { label: t('analytics.detail.window.last_60_days'), value: MetricsWindow.LAST_60_DAYS },
];

const TABS = [
  { value: 'overview', label: t('analytics.detail.tabs.overview') },
  { value: 'retention', label: t('analytics.detail.tabs.retention') },
  { value: 'visits', label: t('analytics.detail.tabs.visits') },
  { value: 'engagement', label: t('analytics.detail.tabs.engagement') },
];

type TabValue = 'overview' | 'retention' | 'visits' | 'engagement';

export function AnalyticsDetailPage() {
  const { placeId = '' } = useParams<{ placeId: string }>();
  const { isSignedIn } = useAuth();
  const {
    window: metricsWindow,
    exportedAt,
    status,
    error,
  } = useSelector(state => state.placeAnalytics);
  const place = useSelector(state => selectors.getPlace(state, placeId));
  const metrics = useSelector(state => selectors.getPlaceMetrics(state, placeId));
  const [tab, setTab] = useState<TabValue>('overview');
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const isLoading = status === 'idle' || status === 'loading';

  // One batched request answers every tab, so a deep link only has to make sure
  // the snapshot is loaded.
  useEffect(() => {
    if (isSignedIn && status === 'idle') dispatch(placeAnalyticsActions.fetchAnalytics());
  }, [isSignedIn, status]);

  const handleBack = useCallback(() => navigate('/analytics'), [navigate]);

  const handleTabChange = useCallback((_e: SyntheticEvent, value: TabValue) => {
    setTab(value);
  }, []);

  const handleWindowChange = useCallback((e: SelectChangeEvent<MetricsWindow>) => {
    dispatch(placeAnalyticsActions.setWindow(e.target.value as MetricsWindow));
  }, []);

  const projections = useMemo(
    () =>
      metrics
        ? {
            overview: toOverview(metrics, metricsWindow),
            retention: toRetention(metrics, metricsWindow),
            visits: toVisits(metrics, metricsWindow),
            engagement: toEngagement(metrics, metricsWindow),
            isEmpty: hasNoData(metrics),
          }
        : null,
    [metrics, metricsWindow],
  );

  const title = place
    ? t('analytics.detail.title', { name: place.name })
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
        ) : status === 'failed' ? (
          <Box className="ErrorContainer">
            <Typography variant="h5">{t('analytics.detail.error.title')}</Typography>
            <Typography variant="body1">{error}</Typography>
          </Box>
        ) : !place || !projections ? (
          <Box className="ErrorContainer">
            <Typography variant="h5">{t('analytics.detail.not_found.title')}</Typography>
            <Typography variant="body1">{t('analytics.detail.not_found.description')}</Typography>
          </Box>
        ) : (
          <Box className="Content">
            <PlaceCard
              place={{
                placeId,
                name: place.name,
                thumbnail: place.thumbnail,
                likeRate: null,
                access: PlaceAccess.PUBLIC,
                publishedIn: place.publishedIn,
                location: place.location,
                lastPublishedBy: null,
                lastUpdatedAt: place.lastUpdatedAt,
              }}
            />
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
                    />
                  ))}
                </Tabs>
                <Box className="DateRange">
                  <Typography variant="body1">{t('analytics.detail.window.title')}</Typography>
                  <Select
                    value={metricsWindow}
                    onChange={handleWindowChange}
                  >
                    {WINDOW_OPTIONS.map(option => (
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
              {/*
               * An empty bag means either "no rows in today's export" or "this
               * wallet may not read it" — deliberately indistinguishable, and
               * never an error.
               */}
              {projections.isEmpty ? (
                <Box className="EmptyContainer">
                  <Typography variant="h5">{t('analytics.no_data_yet')}</Typography>
                  <Typography variant="body1">{t('analytics.no_data_yet_description')}</Typography>
                </Box>
              ) : (
                <>
                  {tab === 'overview' && <OverviewTab overview={projections.overview} />}
                  {tab === 'retention' && <RetentionTab retention={projections.retention} />}
                  {tab === 'visits' && <VisitsTab visits={projections.visits} />}
                  {tab === 'engagement' && <EngagementTab engagement={projections.engagement} />}
                </>
              )}
              {exportedAt && (
                <Typography
                  variant="body2"
                  className="ExportedAt"
                >
                  {t('analytics.exported_at', { date: formatExportDate(exportedAt) })}
                </Typography>
              )}
            </Box>
          </Box>
        )}
      </Container>
    </main>
  );
}
