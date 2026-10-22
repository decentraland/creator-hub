import { useMemo } from 'react';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Box, Chip, Tooltip, Typography } from 'decentraland-ui2';

import { CURRENT_CYCLE, creatorCycleMetrics } from '/@/lib/creatorFund';
import { t } from '/@/modules/store/translation/utils';

import { formatCount, formatPercentage } from '../../AnalyticsPage/utils';
import { formatCycleDate, formatCycleRange } from '../../CreatorFund/utils';

import './styles.css';

type Props = { address: string };

type Stat = { label: string; tooltip: string; value: string };

/** The running cycle's creator totals, on the three metrics the fund pays on. */
export function CycleSummary({ address }: Props) {
  const metrics = useMemo(() => creatorCycleMetrics(address, CURRENT_CYCLE.id), [address]);

  const stats: Stat[] = [
    {
      label: t('creator_fund.cycle.metrics.new_players.label'),
      tooltip: t('creator_fund.cycle.metrics.new_players.tooltip'),
      value: formatCount(metrics.newPlayers),
    },
    {
      label: t('creator_fund.cycle.metrics.returners.label'),
      tooltip: t('creator_fund.cycle.metrics.returners.tooltip'),
      value: formatCount(metrics.returners),
    },
    {
      label: t('creator_fund.cycle.metrics.day_3_retention.label'),
      tooltip: t('creator_fund.cycle.metrics.day_3_retention.tooltip'),
      value: formatPercentage(metrics.day3Retention),
    },
    {
      label: t('creator_fund.cycle.metrics.playtime.label'),
      tooltip: t('creator_fund.cycle.metrics.playtime.tooltip'),
      value: t('creator_fund.cycle.hours', { value: formatCount(metrics.countedPlaytimeHours) }),
    },
  ];

  return (
    <Box className="CycleSummary">
      <Box className="CycleHeader">
        <Typography variant="h6">{t('creator_fund.cycle.title')}</Typography>
        <Typography
          variant="body2"
          className="Muted"
        >
          {formatCycleRange(CURRENT_CYCLE.start_date, CURRENT_CYCLE.end_date)}
        </Typography>
        <Chip
          size="small"
          className="InProgress"
          label={t('creator_fund.cycle.in_progress', {
            date: formatCycleDate(CURRENT_CYCLE.end_date),
          })}
        />
      </Box>
      <Box className="CycleStats">
        {stats.map(stat => (
          <Box
            className="CycleStat"
            key={stat.label}
          >
            <Box className="CycleStatLabel">
              <Typography variant="body2">{stat.label}</Typography>
              <Tooltip
                title={stat.tooltip}
                placement="top"
                arrow
              >
                <InfoOutlinedIcon
                  fontSize="small"
                  tabIndex={0}
                  aria-label={stat.tooltip}
                />
              </Tooltip>
            </Box>
            <Typography variant="h4">{stat.value}</Typography>
          </Box>
        ))}
      </Box>
      <Typography
        variant="caption"
        className="Muted"
      >
        {t('creator_fund.cycle.no_estimate')}
      </Typography>
    </Box>
  );
}
