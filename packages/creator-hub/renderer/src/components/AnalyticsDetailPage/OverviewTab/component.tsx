import { Box } from 'decentraland-ui2';

import type { PlaceOverviewMetrics } from '/shared/types/place-analytics';

import { t } from '/@/modules/store/translation/utils';

import {
  formatCount,
  formatDecimal,
  formatPercentage,
  getRetentionColor,
} from '../../AnalyticsPage/utils';
import { MetricsCard } from '../MetricsCard';
import { TabHeading } from '../TabHeading';

import './styles.css';

type Props = {
  overview: PlaceOverviewMetrics;
};

function minutes(value: number | null) {
  return {
    value: formatDecimal(value),
    unit: value === null ? undefined : t('analytics.detail.engagement.minutes'),
  };
}

export function OverviewTab({ overview }: Props) {
  return (
    <Box className="OverviewTab">
      <TabHeading
        title={t('analytics.detail.overview.title')}
        description={t('analytics.detail.overview.description')}
      />
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
              label: t('analytics.metrics.new_players.label'),
              tooltip: t('analytics.metrics.new_players.tooltip'),
              value: formatCount(overview.newPlayers),
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
          ]}
        />
        <MetricsCard
          metrics={[
            {
              label: t('analytics.metrics.day_3_retention.label'),
              tooltip: t('analytics.metrics.day_3_retention.tooltip'),
              value: formatPercentage(overview.day3Retention),
              color: getRetentionColor(overview.day3Retention),
            },
            {
              label: t('analytics.metrics.day_7_retention.label'),
              tooltip: t('analytics.metrics.day_7_retention.tooltip'),
              value: formatPercentage(overview.day7Retention),
              color: getRetentionColor(overview.day7Retention),
            },
            {
              label: t('analytics.metrics.median_playtime.label'),
              tooltip: t('analytics.metrics.median_playtime.tooltip'),
              ...minutes(overview.medianPlaytime),
            },
            {
              label: t('analytics.metrics.afk_time.label'),
              tooltip: t('analytics.metrics.afk_time.tooltip'),
              ...minutes(overview.afkTime),
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
