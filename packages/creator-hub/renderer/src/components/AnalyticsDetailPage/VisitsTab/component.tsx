import { Box, Typography } from 'decentraland-ui2';

import type { PlaceVisitsMetrics } from '/shared/types/place-analytics';

import { t } from '/@/modules/store/translation/utils';

import { formatCount } from '../../AnalyticsPage/utils';
import { ChartCard } from '../ChartCard';
import { StatsRow } from '../StatsRow';
import { TimeSeriesChart } from '../charts';

import './styles.css';

type Props = {
  visits: PlaceVisitsMetrics;
};

export function VisitsTab({ visits }: Props) {
  return (
    <Box className="VisitsTab">
      <Typography variant="h5">{t('analytics.detail.visits.title')}</Typography>
      <Typography
        variant="body1"
        className="Description"
      >
        {t('analytics.detail.visits.description')}
      </Typography>
      <Box className="Cards">
        <ChartCard title={t('analytics.detail.visits.unique.title')}>
          <StatsRow
            stats={[
              {
                label: t('analytics.detail.platforms.all'),
                value: formatCount(visits.uniqueVisits.all),
              },
              {
                label: t('analytics.detail.platforms.desktop'),
                value: formatCount(visits.uniqueVisits.desktop),
              },
              {
                label: t('analytics.detail.platforms.mobile'),
                value: formatCount(visits.uniqueVisits.mobile),
              },
            ]}
            footnote={t('analytics.detail.visits.unique.footnote')}
          />
        </ChartCard>
        <ChartCard
          title={t('analytics.detail.visits.weekly_active.title')}
          description={t('analytics.detail.visits.weekly_active.description')}
        >
          <TimeSeriesChart
            points={visits.weeklyActiveUsers}
            seriesName={t('analytics.detail.visits.weekly_active.title')}
            formatValue={formatCount}
          />
        </ChartCard>
        {/*
          Weekly users flow: awaiting a new/returning/reactivated breakdown.
          `unique_visitors_weekly` is a single figure per week, which the chart
          above already draws — there is nothing to stack.

        <ChartCard
          title={t('analytics.detail.visits.flow.title')}
          description={t('analytics.detail.visits.flow.description')}
        >
          <ChartLegend
            entries={[
              {
                label: t('analytics.metrics.new_users.label'),
                color: CATEGORICAL_COLORS[0],
                tooltip: t('analytics.metrics.new_users.tooltip'),
              },
              {
                label: t('analytics.detail.visits.flow.returned.label'),
                color: CATEGORICAL_COLORS[1],
                tooltip: t('analytics.detail.visits.flow.returned.tooltip'),
              },
              {
                label: t('analytics.detail.visits.flow.reactivated.label'),
                color: CATEGORICAL_COLORS[2],
                tooltip: t('analytics.detail.visits.flow.reactivated.tooltip'),
              },
            ]}
          />
          <StackedBarChart
            dates={flow.map(point => point.date)}
            formatValue={formatCount}
            series={[
              {
                key: 'new',
                label: t('analytics.metrics.new_users.label'),
                values: flow.map(point => point.newUsers),
              },
              {
                key: 'returned',
                label: t('analytics.detail.visits.flow.returned.label'),
                values: flow.map(point => point.returnedUsers),
              },
              {
                key: 'reactivated',
                label: t('analytics.detail.visits.flow.reactivated.label'),
                values: flow.map(point => point.reactivatedUsers),
              },
            ]}
          />
        </ChartCard>
        */}
      </Box>
    </Box>
  );
}
