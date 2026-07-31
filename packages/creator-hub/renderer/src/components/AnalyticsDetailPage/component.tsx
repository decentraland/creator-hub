import { useCallback, useEffect } from 'react';
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
import { actions as placeAnalyticsActions } from '/@/modules/store/placeAnalytics';
import { useAuth } from '/@/hooks/useAuth';

import { Container } from '../Container';
import { Loader } from '../Loader';
import { Navbar, NavbarItem } from '../Navbar';
import { Select } from '../Select';
import { Title } from '../Title';

import { OverviewTab } from './OverviewTab';
import { PlaceCard } from './PlaceCard';

import './styles.css';

const DATE_RANGE_OPTIONS: Array<{ label: string; value: DateRange }> = [
  { label: t('analytics.detail.date_range.last_7_days'), value: DateRange.LAST_7_DAYS },
  { label: t('analytics.detail.date_range.last_30_days'), value: DateRange.LAST_30_DAYS },
  { label: t('analytics.detail.date_range.last_60_days'), value: DateRange.LAST_60_DAYS },
];

/** Only Overview is built; the rest are shown so the shape of the page is honest. */
const TABS = [
  { value: 'overview', label: t('analytics.detail.tabs.overview'), enabled: true },
  { value: 'retention', label: t('analytics.detail.tabs.retention'), enabled: false },
  { value: 'visits', label: t('analytics.detail.tabs.visits'), enabled: false },
  { value: 'engagement', label: t('analytics.detail.tabs.engagement'), enabled: false },
];

export function AnalyticsDetailPage() {
  const { placeId } = useParams<{ placeId: string }>();
  const { isSignedIn } = useAuth();
  const { detail, dateRange } = useSelector(state => state.placeAnalytics);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const isLoading = detail.status === 'idle' || detail.status === 'loading';

  useEffect(() => {
    if (isSignedIn && placeId) {
      dispatch(placeAnalyticsActions.fetchPlaceDetail({ placeId }));
    }
  }, [isSignedIn, placeId, dateRange]);

  useEffect(() => () => void dispatch(placeAnalyticsActions.clearDetail()), []);

  const handleBack = useCallback(() => navigate('/analytics'), [navigate]);

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
                <Tabs value="overview">
                  {TABS.map(tab => (
                    <Tab
                      key={tab.value}
                      value={tab.value}
                      label={tab.label}
                      disabled={!tab.enabled}
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
              <OverviewTab overview={detail.data.overview} />
            </Box>
          </Box>
        )}
      </Container>
    </main>
  );
}
