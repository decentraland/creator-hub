import { useCallback } from 'react';
import PushPinIcon from '@mui/icons-material/PushPin';
import DownloadIcon from '@mui/icons-material/FileDownloadOutlined';
import {
  Box,
  ManaMaticIcon,
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
  formatMinutes,
  formatPercentage,
  formatRevenue,
  getRetentionColor,
} from '../utils';

import './styles.css';

type Props = {
  places: PlaceAnalyticsSummary[];
  pinnedPlaceIds: string[];
  onTogglePin: (placeId: string) => void;
};

export function PlacesTable({ places, pinnedPlaceIds, onTogglePin }: Props) {
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
        text: t('analytics.list.actions.export'),
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
          <TableCell>{t('analytics.list.columns.new_users')}</TableCell>
          <TableCell>{t('analytics.list.columns.day_7_retention')}</TableCell>
          <TableCell>{t('analytics.list.columns.revenue')}</TableCell>
          <TableCell>{t('analytics.list.columns.avg_playtime')}</TableCell>
          <TableCell className="ActionsCell" />
        </TableRow>
      </TableHead>
      <TableBody>
        {places.map(place => (
          <TableRow key={place.placeId}>
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
            <TableCell>{formatCount(place.totalVisits)}</TableCell>
            <TableCell>{formatCount(place.newUsers)}</TableCell>
            <TableCell>
              <Typography
                variant="body2"
                color={getRetentionColor(place.day7Retention)}
              >
                {formatPercentage(place.day7Retention)}
              </Typography>
            </TableCell>
            <TableCell>
              {/* The `Mana` component renders a ButtonBase, so a read-only cell uses the bare icon. */}
              <Box className="RevenueCell">
                <ManaMaticIcon fontSize="small" />
                {formatRevenue(place.revenue)}
              </Box>
            </TableCell>
            <TableCell>{formatMinutes(place.avgPlaytime)}</TableCell>
            <TableCell className="ActionsCell">
              <Dropdown options={getDropdownOptions(place)} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
