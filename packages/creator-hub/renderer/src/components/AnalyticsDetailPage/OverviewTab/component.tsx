import { Box, Typography } from 'decentraland-ui2';

import type { PlaceOverviewMetrics } from '/shared/types/place-analytics';

import { t } from '/@/modules/store/translation/utils';

import {
  formatCount,
  formatDecimal,
  formatMinutes,
  formatPercentage,
  getRetentionColor,
} from '../../AnalyticsPage/utils';
import { MetricsCard } from '../MetricsCard';

import './styles.css';

type Props = {
  overview: PlaceOverviewMetrics;
};

export function OverviewTab({ overview }: Props) {
  return (
    <Box className="OverviewTab">
      <Typography variant="h5">{t('analytics.detail.overview.title')}</Typography>
      <Typography
        variant="body1"
        className="Description"
      >
        {t('analytics.detail.overview.description')}
      </Typography>
      <Box className="Cards">
        <MetricsCard
          headline={{
            label: t('analytics.metrics.total_visits.label'),
            tooltip: t('analytics.metrics.total_visits.tooltip'),
            value: formatCount(overview.totalVisits),
          }}
          metrics={[
            {
              label: t('analytics.metrics.unique_visits.label'),
              tooltip: t('analytics.metrics.unique_visits.tooltip'),
              value: formatCount(overview.uniqueVisits),
            },
            {
              label: t('analytics.metrics.concurrent_users.label'),
              tooltip: t('analytics.metrics.concurrent_users.tooltip'),
              value: formatDecimal(overview.concurrentUsers),
            },
            {
              label: t('analytics.metrics.peak_concurrent_users.label'),
              tooltip: t('analytics.metrics.peak_concurrent_users.tooltip'),
              value: formatCount(overview.peakConcurrentUsers),
            },
            /* new_users: awaiting a first-time-visitor metric.
            {
              label: t('analytics.metrics.new_users.label'),
              tooltip: t('analytics.metrics.new_users.tooltip'),
              value: formatCount(overview.newUsers),
            }, */
            /* revenue: awaiting a revenue metric.
            {
              label: t('analytics.metrics.revenue.label'),
              tooltip: t('analytics.metrics.revenue.tooltip'),
              value: <ManaValue>{formatRevenue(overview.revenue)}</ManaValue>,
            }, */
          ]}
        />
        <MetricsCard
          headline={{
            label: t('analytics.metrics.day_7_retention.label'),
            tooltip: t('analytics.metrics.day_7_retention.tooltip'),
            value: formatPercentage(overview.day7Retention),
            color: getRetentionColor(overview.day7Retention),
          }}
          metrics={[
            {
              label: t('analytics.metrics.avg_playtime.label'),
              tooltip: t('analytics.metrics.avg_playtime.tooltip'),
              value: formatMinutes(overview.avgPlaytime),
            },
            {
              label: t('analytics.metrics.afk_time.label'),
              tooltip: t('analytics.metrics.afk_time.tooltip'),
              value: formatMinutes(overview.afkTime),
            },
            {
              label: t('analytics.metrics.desktop.label'),
              tooltip: t('analytics.metrics.desktop.tooltip'),
              value: formatCount(overview.desktopUsers),
            },
            {
              label: t('analytics.metrics.mobile.label'),
              tooltip: t('analytics.metrics.mobile.tooltip'),
              value: formatCount(overview.mobileUsers),
            },
          ]}
        />
      </Box>
    </Box>
  );
}
