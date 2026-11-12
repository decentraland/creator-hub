import { useEffect } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  Switch,
  Typography,
} from 'decentraland-ui2';

import { hasSharingConsent } from '/shared/types/ai-sharing';

import { useDispatch, useSelector } from '#store';
import { useAuth } from '/@/hooks/useAuth';
import {
  actions as aiSharingActions,
  isSharingFeatureOn,
  selectSharingConsent,
} from '/@/modules/store/aiSharing';
import { t } from '/@/modules/store/translation/utils';

const PREVIEW_ROWS = 5;

/**
 * Settings → AI: the sharing switch, what is waiting to upload, and deleting everything shared.
 * Owns its state through the store (not the tab's settings props), because turning sharing off
 * must also empty the local queue and tell the server, which the plain settings write can't do.
 */
export function AiSharingSection() {
  const dispatch = useDispatch();
  const { isSignedIn } = useAuth();
  const featureOn = useSelector(isSharingFeatureOn);
  const consent = useSelector(selectSharingConsent);
  const { queued, deleteStatus, deletedCount } = useSelector(state => state.aiSharing);
  const sharing = hasSharingConsent(consent);

  useEffect(() => {
    if (featureOn) void dispatch(aiSharingActions.refreshQueue());
    return () => {
      dispatch(aiSharingActions.resetDelete());
    };
  }, [featureOn, dispatch]);

  if (!featureOn) return null;

  return (
    <>
      <hr className="AiDivider" />
      <Box className="AiField">
        <FormControlLabel
          control={
            <Switch
              checked={sharing}
              disabled={!isSignedIn && !sharing}
              onChange={(_event, checked) => void dispatch(aiSharingActions.decide(checked))}
            />
          }
          label={t('modal.app_settings.fields.ai_sharing.label')}
        />
        <Typography
          variant="body2"
          color="text.secondary"
          className="AiHint"
        >
          {isSignedIn
            ? t('modal.app_settings.fields.ai_sharing.description')
            : t('modal.app_settings.fields.ai_sharing.signin')}
        </Typography>

        <Box className="AiNestedField">
          {sharing && (
            <Box>
              <Typography variant="body2">
                {queued.length > 0
                  ? t('modal.app_settings.fields.ai_sharing.queued_title', {
                      count: queued.length,
                    })
                  : t('modal.app_settings.fields.ai_sharing.queued_empty')}
              </Typography>
              {queued.slice(0, PREVIEW_ROWS).map(item => (
                <Typography
                  key={item.recordId}
                  variant="caption"
                  color="text.secondary"
                  component="div"
                  noWrap
                >
                  {new Date(item.startedAt).toLocaleString()} · {item.promptPreview}
                </Typography>
              ))}
            </Box>
          )}

          {isSignedIn && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Button
                color="secondary"
                variant="text"
                size="small"
                disabled={deleteStatus === 'deleting'}
                onClick={() => void dispatch(aiSharingActions.deleteEverything())}
                sx={{
                  backgroundColor: 'var(--dark-gray)',
                  '&:hover': { backgroundColor: 'var(--light-gray)' },
                  '&&&&&&&': { color: 'var(--white)' },
                }}
              >
                {deleteStatus === 'deleting'
                  ? t('modal.app_settings.fields.ai_sharing.deleting')
                  : t('modal.app_settings.fields.ai_sharing.delete')}
              </Button>
              {deleteStatus === 'deleting' && <CircularProgress size={16} />}
            </Box>
          )}
          {deleteStatus === 'deleted' && (
            <Typography
              variant="caption"
              color="text.secondary"
              role="status"
            >
              {t('modal.app_settings.fields.ai_sharing.deleted', { count: deletedCount ?? 0 })}
            </Typography>
          )}
          {deleteStatus === 'failed' && (
            <Typography
              variant="caption"
              color="error"
              role="alert"
            >
              {t('modal.app_settings.fields.ai_sharing.delete_failed')}
            </Typography>
          )}
        </Box>
      </Box>
    </>
  );
}
