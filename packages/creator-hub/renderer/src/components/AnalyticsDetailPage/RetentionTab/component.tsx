import { Box } from 'decentraland-ui2';

import type {
  MetricsWindow,
  PlaceRetentionMetrics,
  PlatformBreakdown,
} from '/shared/types/place-analytics';
import { DAY_7_RETENTION_BENCHMARK } from '/shared/types/place-analytics';

import { t } from '/@/modules/store/translation/utils';

import { formatPercentage } from '../../AnalyticsPage/utils';
import { ChartCard } from '../ChartCard';
import { StatsRow } from '../StatsRow';
import { TabHeading } from '../TabHeading';
import { TimeSeriesChart } from '../charts';

import './styles.css';

type Props = {
  retention: PlaceRetentionMetrics;
  window: MetricsWindow;
};

function platformStats(values: PlatformBreakdown, tooltipKey: 'platforms' | 'day_3') {
  return (['all', 'desktop', 'mobile'] as const).map(platform => ({
    label: t(`analytics.detail.platforms.${platform}`),
    tooltip: t(`analytics.detail.retention.${tooltipKey}.tooltips.${platform}`),
    value: formatPercentage(values[platform]),
  }));
}

export function RetentionTab({ retention, window }: Props) {
  return (
    <Box className="RetentionTab">
      <TabHeading
        title={t('analytics.detail.retention.title')}
        description={t('analytics.detail.retention.description')}
      />
      <Box className="Cards">
        <ChartCard
          title={t('analytics.detail.retention.platforms.title')}
          description={t('analytics.detail.retention.platforms.description', {
            days: Number.parseInt(window, 10),
          })}
        >
          <StatsRow stats={platformStats(retention.platforms, 'platforms')} />
        </ChartCard>
        <ChartCard
          title={t('analytics.detail.retention.day_3.title')}
          description={t('analytics.detail.retention.day_3.description')}
        >
          <StatsRow stats={platformStats(retention.day3Platforms, 'day_3')} />
        </ChartCard>
        <ChartCard
          title={t('analytics.detail.retention.day_3_cohort.title')}
          description={t('analytics.detail.retention.day_3_cohort.description')}
        >
          <TimeSeriesChart
            points={retention.day3ByCohortWeek}
            seriesName={t('analytics.metrics.day_3_retention.label')}
            formatValue={formatPercentage}
            reference={{
              value: DAY_7_RETENTION_BENCHMARK,
              label: t('analytics.detail.retention.day_3_cohort.benchmark', {
                value: DAY_7_RETENTION_BENCHMARK,
              }),
            }}
          />
        </ChartCard>
        <ChartCard
          title={t('analytics.detail.retention.day_7_cohort.title')}
          description={t('analytics.detail.retention.day_7_cohort.description')}
        >
          <TimeSeriesChart
            points={retention.day7ByCohortWeek}
            seriesName={t('analytics.metrics.day_7_retention.label')}
            formatValue={formatPercentage}
            reference={{
              value: DAY_7_RETENTION_BENCHMARK,
              label: t('analytics.detail.retention.day_7_cohort.benchmark', {
                value: DAY_7_RETENTION_BENCHMARK,
              }),
            }}
          />
        </ChartCard>
        <ChartCard
          title={t('analytics.detail.retention.churn.title')}
          description={t('analytics.detail.retention.churn.description')}
        >
          <TimeSeriesChart
            points={retention.weeklyChurnRate}
            seriesName={t('analytics.detail.retention.churn.title')}
            formatValue={formatPercentage}
            maxValue={100}
          />
        </ChartCard>
      </Box>
    </Box>
  );
}
