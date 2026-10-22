import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { Box, Typography } from 'decentraland-ui2';

import type { PlaceAnalyticsSummary } from '/shared/types/place-analytics';

import { creatorFundMetrics, placeFundMetrics } from '/@/lib/creatorFund';
import { t } from '/@/modules/store/translation/utils';

import { Button } from '../../Button';
import { StatsRow } from '../../AnalyticsDetailPage/StatsRow';
import { formatCount, formatPercentage } from '../utils';

import './styles.css';

type Props = {
  /** Every place, not just the ones the search box leaves. */
  places: PlaceAnalyticsSummary[];
};

/** The creator's totals across their places, on the metrics the Creator Fund pays on. */
export function CreatorSummary({ places }: Props) {
  const navigate = useNavigate();
  const totals = useMemo(
    () => creatorFundMetrics(places.map(place => placeFundMetrics(place.placeId, place))),
    [places],
  );
  const totalVisits = useMemo(
    () =>
      places.some(place => place.totalVisits !== null)
        ? places.reduce((sum, place) => sum + (place.totalVisits ?? 0), 0)
        : null,
    [places],
  );

  return (
    <Box className="CreatorSummary">
      <Box className="CreatorSummaryHeader">
        <Box>
          <Typography variant="h6">{t('analytics.creator_summary.title')}</Typography>
          <Typography
            variant="body2"
            className="Muted"
          >
            {t('analytics.creator_summary.description')}
          </Typography>
        </Box>
        <Button
          variant="text"
          color="secondary"
          endIcon={<ChevronRightIcon />}
          onClick={() => navigate('/payouts')}
        >
          {t('analytics.creator_summary.link')}
        </Button>
      </Box>
      <StatsRow
        stats={[
          {
            label: t('analytics.metrics.new_players.label'),
            value: formatCount(totals.newPlayers),
          },
          {
            label: t('analytics.metrics.day_3_retention.label'),
            value: formatPercentage(totals.day3Retention),
          },
          {
            label: t('analytics.metrics.total_visits.label'),
            value: formatCount(totalVisits),
          },
        ]}
        footnote={t('analytics.creator_summary.mock')}
      />
    </Box>
  );
}
