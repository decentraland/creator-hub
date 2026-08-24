import { useCallback } from 'react';
import PushPinIcon from '@mui/icons-material/PushPin';
import DownloadIcon from '@mui/icons-material/FileDownloadOutlined';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from 'decentraland-ui2';

import type { PlaceAnalyticsSummary } from '/shared/types/place-analytics';

import { t } from '/@/modules/store/translation/utils';

import { Dropdown } from '../../Dropdown';
import {
  formatCount,
  formatDecimal,
  formatMinutes,
  formatPercentage,
  getRetentionColor,
} from '../utils';

import './styles.css';

type Props = {
  places: PlaceAnalyticsSummary[];
  pinnedPlaceIds: string[];
  onTogglePin: (placeId: string) => void;
  onSelectPlace: (placeId: string) => void;
};

export function PlacesTable({ places, pinnedPlaceIds, onTogglePin, onSelectPlace }: Props) {
  const getDropdownOptions = useCallback(
    (place: PlaceAnalyticsSummary) => [
      {
        text: pinnedPlaceIds.includes(place.placeId)
          ? t('analytics.list.actions.unpin_from_watchlist')
          : t('analytics.list.actions.pin_to_watchlist'),
        icon: <PushPinIcon />,
        handler: () => onTogglePin(place.placeId),
      },
      {
        text: t('analytics.actions.export'),
        icon: <DownloadIcon />,
        // Enabled once there is an analytics API to export from.
        disabled: true,
        handler: () => undefined,
      },
    ],
    [pinnedPlaceIds, onTogglePin],
  );

  return (
    <Table className="PlacesTable">
      <TableHead>
        <TableRow>
          <TableCell>{t('analytics.list.columns.place')}</TableCell>
          <TableCell>{t('analytics.list.columns.total_visits')}</TableCell>
          {/* new_users: awaiting a first-time-visitor metric.
          <TableCell>{t('analytics.list.columns.new_users')}</TableCell> */}
          <TableCell>{t('analytics.list.columns.day_7_retention')}</TableCell>
          {/* revenue: awaiting a revenue metric.
          <TableCell>{t('analytics.list.columns.revenue')}</TableCell> */}
          <TableCell>{t('analytics.list.columns.avg_playtime')}</TableCell>
          <TableCell>{t('analytics.list.columns.concurrent_users')}</TableCell>
          <TableCell className="ActionsCell" />
        </TableRow>
      </TableHead>
      <TableBody>
        {places.map(place => (
          <TableRow
            key={place.placeId}
            hover
            tabIndex={0}
            role="button"
            aria-label={place.name}
            onClick={() => onSelectPlace(place.placeId)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectPlace(place.placeId);
              }
            }}
          >
            <TableCell>
              <Box className="PlaceCell">
                <img
                  className="Thumbnail"
                  src={place.thumbnail}
                  alt=""
                />
                <Typography variant="body2">{place.name}</Typography>
                {pinnedPlaceIds.includes(place.placeId) && (
                  <PushPinIcon
                    className="PinnedIcon"
                    fontSize="small"
                    titleAccess={t('analytics.list.pinned')}
                  />
                )}
              </Box>
            </TableCell>
            {place.hasNoData ? (
              /*
               * The API returned nothing for this scene — either it holds no rows
               * in today's export or this wallet may not read it, deliberately
               * indistinguishable. Neither is an error.
               */
              <TableCell
                colSpan={4}
                className="NoDataCell"
              >
                <Typography variant="body2">{t('analytics.no_data_yet')}</Typography>
              </TableCell>
            ) : (
              <>
                <TableCell>{formatCount(place.totalVisits)}</TableCell>
                {/* new_users: awaiting a first-time-visitor metric.
                <TableCell>{formatCount(place.newUsers)}</TableCell> */}
                <TableCell>
                  <Typography
                    variant="body2"
                    color={getRetentionColor(place.day7Retention)}
                  >
                    {formatPercentage(place.day7Retention)}
                  </Typography>
                </TableCell>
                {/* revenue: awaiting a revenue metric.
                <TableCell>
                  <ManaValue>{formatRevenue(place.revenue)}</ManaValue>
                </TableCell> */}
                <TableCell>{formatMinutes(place.avgPlaytime)}</TableCell>
                <TableCell>{formatDecimal(place.concurrentUsers)}</TableCell>
              </>
            )}
            <TableCell className="ActionsCell">
              <Dropdown options={getDropdownOptions(place)} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
