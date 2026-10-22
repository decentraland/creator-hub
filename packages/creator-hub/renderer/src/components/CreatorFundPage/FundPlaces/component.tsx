import { useNavigate } from 'react-router-dom';
import { Box, Typography } from 'decentraland-ui2';

import { useSelector } from '#store';
import type { AnalyticsPlace } from '/@/lib/analyticsLocations';
import { PROGRAM, PayoutReason, fundKeyOfLocation } from '/@/lib/creatorFund';
import { t } from '/@/modules/store/translation/utils';

import { Button } from '../../Button';
import { Loader } from '../../Loader';
import { EligibilityChip } from '../../CreatorFund/EligibilityChip';

import './styles.css';

type Props = {
  places: AnalyticsPlace[];
  isLoading: boolean;
  /** Without this a failed request reads as "you have no scenes yet". */
  isFailed: boolean;
};

function LastCycle({ place }: { place: AnalyticsPlace }) {
  const eligibility = useSelector(
    state => state.creatorFund.places[fundKeyOfLocation(place.location)],
  );
  // Only places that can take part have a last cycle worth reporting.
  if (!eligibility?.opt_in.eligible) return null;

  const belowMinimum = eligibility.cycle.reasons.includes(PayoutReason.BELOW_MIN_PLAYERS);
  return (
    <Typography
      variant="body2"
      className={belowMinimum ? 'LastCycle Below' : 'LastCycle'}
    >
      {belowMinimum
        ? t('creator_fund.places.below_min_players', { count: PROGRAM.minPlayers })
        : t('creator_fund.places.qualified')}
    </Typography>
  );
}

export function FundPlaces({ places, isLoading, isFailed }: Props) {
  const navigate = useNavigate();

  return (
    <Box className="FundPlaces">
      <Box className="SectionHeader">
        <Box>
          <Typography variant="h5">{t('creator_fund.places.title')}</Typography>
          <Typography
            variant="body2"
            className="Muted"
          >
            {t('creator_fund.places.description')}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          color="secondary"
          onClick={() => navigate('/manage')}
        >
          {t('creator_fund.places.manage')}
        </Button>
      </Box>
      {isLoading && places.length === 0 ? (
        <Loader size={40} />
      ) : isFailed ? (
        <Typography
          variant="body2"
          className="Muted"
        >
          {t('creator_fund.places.error')}
        </Typography>
      ) : places.length === 0 ? (
        <Typography
          variant="body2"
          className="Muted"
        >
          {t('creator_fund.places.empty')}
        </Typography>
      ) : (
        <ul className="PlaceList">
          {places.map(place => (
            <li
              key={place.placeId}
              className="PlaceRow"
            >
              <img
                className="Thumbnail"
                src={place.thumbnail}
                alt=""
              />
              <Box className="PlaceName">
                <Typography variant="subtitle2">{place.name}</Typography>
                {/* A single-scene World is named after the World; don't say it twice. */}
                {place.publishedIn !== place.name && (
                  <Typography
                    variant="body2"
                    className="Muted"
                  >
                    {place.publishedIn}
                  </Typography>
                )}
              </Box>
              <LastCycle place={place} />
              <EligibilityChip fundKey={fundKeyOfLocation(place.location)} />
            </li>
          ))}
        </ul>
      )}
    </Box>
  );
}
