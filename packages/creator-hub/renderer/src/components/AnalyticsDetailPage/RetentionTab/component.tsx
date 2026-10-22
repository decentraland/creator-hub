import { Box, Typography } from 'decentraland-ui2';

import type { PlaceRetentionMetrics } from '/shared/types/place-analytics';
import { DAY_7_RETENTION_BENCHMARK } from '/shared/types/place-analytics';

import type { PlaceDay3Retention } from '/@/lib/creatorFund';
import { t } from '/@/modules/store/translation/utils';

import { formatPercentage } from '../../AnalyticsPage/utils';
import { ChartCard } from '../ChartCard';
import { StatsRow } from '../StatsRow';
import { TimeSeriesChart } from '../charts';

import './styles.css';

type Props = {
  retention: PlaceRetentionMetrics;
  /** Creator Fund POC: mocked Day 3 counterparts of the Day 7 cards. */
  day3: PlaceDay3Retention;
};

export function RetentionTab({ retention, day3 }: Props) {
  return (
    <Box className="RetentionTab">
      <Typography variant="h5">{t('analytics.detail.retention.title')}</Typography>
      <Typography
        variant="body1"
        className="Description"
      >
        {t('analytics.detail.retention.description')}
      </Typography>
      <Box className="Cards">
        <ChartCard
          title={t('analytics.detail.retention.platforms.title')}
          description={t('analytics.detail.retention.platforms.description')}
        >
          <StatsRow
            stats={[
              {
                label: t('analytics.detail.platforms.all'),
                value: formatPercentage(retention.platforms.all),
              },
              {
                label: t('analytics.detail.platforms.desktop'),
                value: formatPercentage(retention.platforms.desktop),
              },
              {
                label: t('analytics.detail.platforms.mobile'),
                value: formatPercentage(retention.platforms.mobile),
              },
            ]}
          />
        </ChartCard>
        <ChartCard
          title={t('analytics.detail.retention.day_3_platforms.title')}
          description={t('analytics.detail.retention.day_3_platforms.description')}
        >
          <StatsRow
            stats={[
              {
                label: t('analytics.detail.platforms.all'),
                value: formatPercentage(day3.platforms.all),
              },
              {
                label: t('analytics.detail.platforms.desktop'),
                value: formatPercentage(day3.platforms.desktop),
              },
              {
                label: t('analytics.detail.platforms.mobile'),
                value: formatPercentage(day3.platforms.mobile),
              },
            ]}
          />
        </ChartCard>
        <ChartCard
          title={t('analytics.detail.retention.day_3_cohort.title')}
          description={t('analytics.detail.retention.day_3_cohort.description')}
        >
          <TimeSeriesChart
            points={day3.byCohortWeek}
            seriesName={t('analytics.metrics.day_3_retention.label')}
            formatValue={formatPercentage}
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
        {/*
          Weekly churn: awaiting a churn metric. `d7_retention_rate_weekly` is
          day-7 cohort retention, and 1 - d7 is not churn — showing it here would
          render a plausible wrong number.

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
        */}
      </Box>
    </Box>
  );
}
