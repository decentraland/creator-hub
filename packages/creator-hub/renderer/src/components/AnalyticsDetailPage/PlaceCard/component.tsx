import { useCallback } from 'react';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CalendarIcon from '@mui/icons-material/CalendarMonth';
import EditIcon from '@mui/icons-material/Edit';
import LinkIcon from '@mui/icons-material/Link';
import LockIcon from '@mui/icons-material/Lock';
import PlaceIcon from '@mui/icons-material/Place';
import PublicIcon from '@mui/icons-material/Public';
import ThumbUpIcon from '@mui/icons-material/ThumbUpAlt';
import { Avatar, Box, Button, Tooltip, Typography } from 'decentraland-ui2';

import type { PlaceDetails } from '/shared/types/place-analytics';
import { PlaceAccess } from '/shared/types/place-analytics';

import { misc } from '#preload';
import { useSnackbar } from '/@/hooks/useSnackbar';
import { t } from '/@/modules/store/translation/utils';
import { CREATE_EVENT_URL, getSceneJumpInDeeplink, getSceneJumpInUrl } from '/@/modules/utils';

import { formatDateTime, formatPercentage } from '../../AnalyticsPage/utils';

import './styles.css';

type Props = {
  place: PlaceDetails;
};

export function PlaceCard({ place }: Props) {
  const { pushGeneric } = useSnackbar();
  const jumpInUrl = getSceneJumpInUrl(place.location);

  const handleCreateEvent = useCallback(() => {
    void misc.openExternal(CREATE_EVENT_URL);
  }, []);

  const handleCopyUrl = useCallback(() => {
    void misc.copyToClipboard(jumpInUrl);
    pushGeneric('success', t('snackbar.generic.url_copied'));
  }, [jumpInUrl, pushGeneric]);

  /** Opens the desktop client itself; Copy URL keeps the shareable web link. */
  const handleJumpIn = useCallback(() => {
    void misc.openExternal(getSceneJumpInDeeplink(place.location));
  }, [place.location]);

  return (
    <Box className="PlaceCard">
      <img
        className="Thumbnail"
        src={place.thumbnail}
        alt=""
      />
      <Box className="Details">
        <Typography variant="h5">{place.name}</Typography>
        {place.likeRate !== null && (
          <Box className="LikeRate">
            <ThumbUpIcon fontSize="small" />
            <Typography variant="body1">{formatPercentage(place.likeRate)}</Typography>
          </Box>
        )}
        <Box className="Field">
          <Typography variant="body2">{t('analytics.detail.place.access')}</Typography>
          <Box className="FieldValue">
            {place.access === PlaceAccess.PRIVATE ? (
              <LockIcon fontSize="small" />
            ) : (
              <PublicIcon fontSize="small" />
            )}
            <Typography variant="body1">
              {place.access === PlaceAccess.PRIVATE
                ? t('analytics.detail.place.private')
                : t('analytics.detail.place.public')}
            </Typography>
          </Box>
        </Box>
        <Box className="Field">
          <Typography variant="body2">{t('analytics.detail.place.published_in')}</Typography>
          <Box className="FieldValue">
            <PlaceIcon fontSize="small" />
            <Typography variant="body1">{place.publishedIn}</Typography>
          </Box>
        </Box>
        {place.lastPublishedBy && (
          <Box className="Field">
            <Typography variant="body2">{t('analytics.detail.place.last_published_by')}</Typography>
            <Box className="FieldValue">
              <Avatar
                className="PublisherAvatar"
                src={place.lastPublishedBy.avatar ?? undefined}
              >
                {place.lastPublishedBy.name.charAt(0)}
              </Avatar>
              <Typography variant="body1">{place.lastPublishedBy.name}</Typography>
            </Box>
          </Box>
        )}
        <Box className="Field">
          <Typography variant="body2">{t('analytics.detail.place.last_update')}</Typography>
          <Typography variant="body1">{formatDateTime(place.lastUpdatedAt)}</Typography>
        </Box>
      </Box>
      <Box className="Actions">
        <Button
          variant="text"
          color="secondary"
          className="Action"
          onClick={handleCreateEvent}
        >
          <CalendarIcon />
          {t('analytics.detail.actions.create_event')}
        </Button>
        {/* Enabled once a published Place can be matched to a local scene. */}
        <Tooltip title={t('analytics.detail.actions.edit_scene_unavailable')}>
          <span>
            <Button
              variant="text"
              color="secondary"
              className="Action"
              disabled
            >
              <EditIcon />
              {t('analytics.detail.actions.edit_scene')}
            </Button>
          </span>
        </Tooltip>
        <Button
          variant="text"
          color="secondary"
          className="Action"
          onClick={handleCopyUrl}
        >
          <LinkIcon />
          {t('analytics.detail.actions.copy_url')}
        </Button>
      </Box>
      <Button
        variant="contained"
        className="JumpIn"
        onClick={handleJumpIn}
        endIcon={<ArrowForwardIcon />}
      >
        {t('analytics.detail.actions.jump_in')}
      </Button>
    </Box>
  );
}
