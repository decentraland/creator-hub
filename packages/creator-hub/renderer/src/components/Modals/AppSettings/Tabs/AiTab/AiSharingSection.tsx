import { useEffect, useState } from 'react';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  IconButton,
  Switch,
  Tooltip,
  Typography,
} from 'decentraland-ui2';

import { hasSharingConsent } from '/shared/types/ai-sharing';

import { useDispatch, useSelector } from '#store';
import { useAuth } from '/@/hooks/useAuth';
import {
  actions as aiSharingActions,
  canManageSharing,
  isSharingFeatureOn,
  selectSharingConsent,
} from '/@/modules/store/aiSharing';
import { t } from '/@/modules/store/translation/utils';

const PREVIEW_ROWS = 5;

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

const buttonSx = {
  backgroundColor: 'var(--dark-gray)',
  '&:hover': { backgroundColor: 'var(--light-gray)' },
  '&&&&&&&': { color: 'var(--white)' },
};

/**
 * Settings → AI: the sharing switch, what is waiting to upload, what has been shared, and
 * deleting it. Owns its state through the store (not the tab's settings props), because turning
 * sharing off must also empty the local queue and tell the service, which a plain settings write
 * can't do. Shown wherever sharing is offered, and wherever the signed-in wallet has a decision
 * stored, so withdrawing and erasing stay possible after the feature is turned off.
 */
export function AiSharingSection() {
  const dispatch = useDispatch();
  const { wallet } = useAuth();
  const address = wallet?.toLowerCase() ?? null;
  const visible = useSelector(state => canManageSharing(state, address));
  const offered = useSelector(isSharingFeatureOn);
  const consent = useSelector(state => selectSharingConsent(state, address));
  const { queued, deleteStatus, deletedCount, shared } = useSelector(state => state.aiSharing);
  const sharing = hasSharingConsent(consent);
  const [showShared, setShowShared] = useState(false);

  useEffect(() => {
    if (visible) void dispatch(aiSharingActions.refreshQueue());
    return () => {
      dispatch(aiSharingActions.resetDelete());
    };
  }, [visible, dispatch]);

  useEffect(() => {
    if (showShared && address !== null) {
      void dispatch(aiSharingActions.loadSharedTurns({ reset: true }));
    }
  }, [showShared, address, dispatch]);

  if (!visible) return null;
  const queuedHere = queued.filter(item => item.address === address);

  return (
    <>
      <hr className="AiDivider" />
      <Box className="AiField">
        <FormControlLabel
          control={
            <Switch
              checked={sharing}
              disabled={address === null || (!sharing && !offered)}
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
          {address !== null
            ? t('modal.app_settings.fields.ai_sharing.description')
            : t('modal.app_settings.fields.ai_sharing.signin')}
        </Typography>

        {address !== null && (
          <Box className="AiNestedField">
            {sharing && (
              <Box>
                <Typography variant="body2">
                  {queuedHere.length > 0
                    ? t('modal.app_settings.fields.ai_sharing.queued_title', {
                        count: queuedHere.length,
                      })
                    : t('modal.app_settings.fields.ai_sharing.queued_empty')}
                </Typography>
                {queuedHere.slice(0, PREVIEW_ROWS).map(item => (
                  <Typography
                    key={item.recordId}
                    variant="caption"
                    color="text.secondary"
                    component="div"
                    noWrap
                  >
                    {when(item.startedAt)} · {item.promptPreview}
                  </Typography>
                ))}
              </Box>
            )}

            <Box>
              <Button
                color="secondary"
                variant="text"
                size="small"
                aria-expanded={showShared}
                aria-controls="ai-sharing-shared-turns"
                onClick={() => setShowShared(open => !open)}
                sx={buttonSx}
              >
                {showShared
                  ? t('modal.app_settings.fields.ai_sharing.viewer_hide')
                  : t('modal.app_settings.fields.ai_sharing.viewer_show')}
              </Button>
              {showShared && (
                <Box
                  id="ai-sharing-shared-turns"
                  sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}
                >
                  {shared.status === 'failed' && (
                    <Typography
                      variant="caption"
                      color="error"
                      role="alert"
                    >
                      {t('modal.app_settings.fields.ai_sharing.viewer_failed')}
                    </Typography>
                  )}
                  {shared.status === 'loaded' && shared.turns.length === 0 && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                    >
                      {t('modal.app_settings.fields.ai_sharing.viewer_empty')}
                    </Typography>
                  )}
                  {shared.turns.map(turn => (
                    <Box
                      key={turn.recordId}
                      sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}
                    >
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        noWrap
                        sx={{ flex: 1, minWidth: 0 }}
                      >
                        {when(turn.startedAt)} · {turn.prompt.text}
                      </Typography>
                      <Tooltip title={t('modal.app_settings.fields.ai_sharing.viewer_delete')}>
                        <span>
                          <IconButton
                            size="small"
                            aria-label={t('modal.app_settings.fields.ai_sharing.viewer_delete')}
                            disabled={shared.erasing.includes(turn.recordId)}
                            onClick={() =>
                              void dispatch(aiSharingActions.eraseSharedTurn(turn.recordId))
                            }
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                  ))}
                  {shared.status === 'loading' && <CircularProgress size={16} />}
                  {shared.next !== null && shared.status === 'loaded' && (
                    <Button
                      color="secondary"
                      variant="text"
                      size="small"
                      onClick={() =>
                        void dispatch(aiSharingActions.loadSharedTurns({ reset: false }))
                      }
                      sx={{ alignSelf: 'flex-start', ...buttonSx }}
                    >
                      {t('modal.app_settings.fields.ai_sharing.viewer_more')}
                    </Button>
                  )}
                </Box>
              )}
            </Box>

            {deleteStatus === 'confirming' ? (
              <Box
                role="group"
                aria-label={t('modal.app_settings.fields.ai_sharing.delete')}
                sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
              >
                <Typography variant="body2">
                  {t('modal.app_settings.fields.ai_sharing.delete_confirm')}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    color="error"
                    variant="contained"
                    size="small"
                    onClick={() => void dispatch(aiSharingActions.deleteEverything())}
                  >
                    {t('modal.app_settings.fields.ai_sharing.delete_confirm_yes')}
                  </Button>
                  <Button
                    color="secondary"
                    variant="text"
                    size="small"
                    onClick={() => dispatch(aiSharingActions.resetDelete())}
                    sx={buttonSx}
                  >
                    {t('modal.app_settings.fields.ai_sharing.delete_cancel')}
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Button
                  color="secondary"
                  variant="text"
                  size="small"
                  disabled={deleteStatus === 'deleting'}
                  onClick={() => dispatch(aiSharingActions.askDeleteConfirmation())}
                  sx={buttonSx}
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
        )}
      </Box>
    </>
  );
}
