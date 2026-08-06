import { Box, Typography } from 'decentraland-ui2';

import type { PlaceEngagementMetrics, PlaytimeMetric } from '/shared/types/place-analytics';

import { t } from '/@/modules/store/translation/utils';

import {
  formatCount,
  formatMinutes,
  formatMinutesDelta,
  formatPercentage,
  getDeltaDirection,
} from '../../AnalyticsPage/utils';
import { ChartCard } from '../ChartCard';
import { HeroStat } from '../HeroStat';
import { CATEGORICAL_COLORS, ChartLegend, MultiLineChart } from '../charts';

import './styles.css';

const SOCIAL_CHART_HEIGHT = 260;

type Props = {
  engagement: PlaceEngagementMetrics;
};

function PlaytimeCard({
  title,
  description,
  chartTitle,
  playtime,
}: {
  title: string;
  description: string;
  chartTitle: string;
  playtime: PlaytimeMetric;
}) {
  return (
    <ChartCard
      title={title}
      description={description}
    >
      <HeroStat
        value={playtime.minutes === null ? '-' : formatCount(playtime.minutes)}
        unit={playtime.minutes === null ? undefined : t('analytics.detail.engagement.minutes')}
        delta={{
          text: t('analytics.detail.engagement.vs_last_week', {
            value: formatMinutesDelta(playtime.deltaMinutes),
          }),
          direction: getDeltaDirection(playtime.deltaMinutes),
        }}
      />
      <Typography
        variant="subtitle1"
        className="ChartTitle"
      >
        {chartTitle}
      </Typography>
      <MultiLineChart
        series={[{ key: 'playtime', label: chartTitle, points: playtime.weekly }]}
        formatValue={formatMinutes}
        height={SOCIAL_CHART_HEIGHT}
        compact
      />
    </ChartCard>
  );
}

export function EngagementTab({ engagement }: Props) {
  const { socialInteractions } = engagement;

  const socialSeries = (which: 'weeklyTotals' | 'visitorRate') => [
    {
      key: 'messages',
      label: t('analytics.detail.engagement.social.messages.label'),
      points: socialInteractions[which].messagesSent,
    },
    {
      key: 'emotes',
      label: t('analytics.detail.engagement.social.emotes.label'),
      points: socialInteractions[which].emotesPlayed,
    },
    {
      key: 'friendships',
      label: t('analytics.detail.engagement.social.friendships.label'),
      points: socialInteractions[which].newFriendships,
    },
  ];

  return (
    <Box className="EngagementTab">
      <Typography variant="h5">{t('analytics.detail.engagement.title')}</Typography>
      <Typography
        variant="body1"
        className="Description"
      >
        {t('analytics.detail.engagement.description')}
      </Typography>
      <Box className="Cards">
        <Box className="PlaytimeCards">
          <PlaytimeCard
            title={t('analytics.detail.engagement.daily.title')}
            description={t('analytics.detail.engagement.daily.description')}
            chartTitle={t('analytics.detail.engagement.daily.chart_title')}
            playtime={engagement.avgDailyPlaytime}
          />
          <PlaytimeCard
            title={t('analytics.detail.engagement.weekly.title')}
            description={t('analytics.detail.engagement.weekly.description')}
            chartTitle={t('analytics.detail.engagement.weekly.chart_title')}
            playtime={engagement.avgWeeklyPlaytime}
          />
        </Box>
        <ChartCard
          title={t('analytics.detail.engagement.social.title')}
          description={t('analytics.detail.engagement.social.description')}
        >
          <ChartLegend
            entries={[
              {
                label: t('analytics.detail.engagement.social.messages.label'),
                color: CATEGORICAL_COLORS[0],
                tooltip: t('analytics.detail.engagement.social.messages.tooltip'),
              },
              {
                label: t('analytics.detail.engagement.social.emotes.label'),
                color: CATEGORICAL_COLORS[1],
                tooltip: t('analytics.detail.engagement.social.emotes.tooltip'),
              },
              {
                label: t('analytics.detail.engagement.social.friendships.label'),
                color: CATEGORICAL_COLORS[2],
                tooltip: t('analytics.detail.engagement.social.friendships.tooltip'),
              },
            ]}
          />
          <Box className="SocialCharts">
            <Box className="SocialChart">
              <Typography
                variant="subtitle1"
                className="ChartTitle"
              >
                {t('analytics.detail.engagement.social.totals_title')}
              </Typography>
              <MultiLineChart
                series={socialSeries('weeklyTotals')}
                formatValue={formatCount}
                height={SOCIAL_CHART_HEIGHT}
                compact
              />
            </Box>
            <Box className="SocialChart">
              <Typography
                variant="subtitle1"
                className="ChartTitle"
              >
                {t('analytics.detail.engagement.social.rate_title')}
              </Typography>
              <MultiLineChart
                series={socialSeries('visitorRate')}
                formatValue={formatPercentage}
                maxValue={100}
                height={SOCIAL_CHART_HEIGHT}
                compact
              />
            </Box>
          </Box>
        </ChartCard>
      </Box>
    </Box>
  );
}
