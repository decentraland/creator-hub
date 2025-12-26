import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Typography, Button, type ButtonProps } from 'decentraland-ui2';
import { InfoOutlined } from '@mui/icons-material';
import { t } from '/@/modules/store/translation/utils';
import { useDispatch, useSelector } from '#store';
import { checkForUpdates, downloadUpdate, installUpdate } from '/@/modules/store/settings/slice';
import { settings as settingsPreload } from '#preload';
import { Row } from '../../../Row';
import { Column } from '../../../Column';
import type { ReleaseNotes } from '/shared/types/settings';
import { MarkdownRenderer } from '../MarkdownRenderer';

import './styles.css';

interface UpdateButtonProps {
  action: () => void;
  text: string;
  disabled?: boolean;
  color: ButtonProps['color'];
}

export const UpdateSettings: React.FC<{ className?: string }> = ({ className = '' }) => {
  const dispatch = useDispatch();
  const {
    downloadingUpdate: { progress, finished, isDownloading },
    updateInfo,
  } = useSelector(state => state.settings);

  const checkForUpdatesStatus = useSelector(state => state.settings.checkForUpdates.status);

  const [hasCheckedForUpdates, setHasCheckedForUpdates] = useState(false);
  const [releaseNotes, setReleaseNotes] = useState<ReleaseNotes | null>(null);

  const shouldShowUpdateAvailable = useCallback(() => {
    return hasCheckedForUpdates && updateInfo.available && updateInfo.version && !isDownloading;
  }, [hasCheckedForUpdates, updateInfo, isDownloading]);

  // Fetch release notes when update check succeeds and update is available
  useEffect(() => {
    const fetchReleaseNotes = async () => {
      if (
        hasCheckedForUpdates &&
        checkForUpdatesStatus === 'succeeded' &&
        updateInfo.available &&
        updateInfo.version
      ) {
        const notes = await settingsPreload.getReleaseNotes(updateInfo.version);
        setReleaseNotes(notes ?? null);
      }
    };

    fetchReleaseNotes();
  }, [hasCheckedForUpdates, checkForUpdatesStatus, updateInfo.available, updateInfo.version]);

  const handleCheckForUpdates = useCallback(async () => {
    setHasCheckedForUpdates(true);
    dispatch(checkForUpdates({ autoDownload: false }));
  }, [dispatch]);

  const handleInstallUpdate = useCallback(async () => {
    dispatch(installUpdate());
  }, []);

  const handleDownloadUpdate = useCallback(async () => {
    dispatch(downloadUpdate());
  }, []);

  const getButtonProps = useCallback((): UpdateButtonProps => {
    if (checkForUpdatesStatus === 'loading') {
      return {
        action: () => {},
        text: t('editor.loading.title'),
        disabled: true,
        color: 'secondary',
      };
    }

    if (progress > 0 && !finished) {
      return {
        action: () => {},
        text: t('modal.app_settings.update.downloading', { progress }),
        disabled: true,
        color: 'inherit',
      };
    }

    if (!hasCheckedForUpdates || checkForUpdatesStatus === 'idle') {
      return {
        action: handleCheckForUpdates,
        text: t('modal.app_settings.update.check'),
        color: 'secondary',
      };
    }

    if (updateInfo.available) {
      const buttonText = updateInfo.isDownloaded
        ? t('modal.app_settings.update.install')
        : t('modal.app_settings.update.update');

      return {
        action: updateInfo.isDownloaded ? handleInstallUpdate : handleDownloadUpdate,
        text: buttonText,
        color: 'primary',
      };
    }

    return {
      action: handleCheckForUpdates,
      text: t('modal.app_settings.update.check'),
      color: 'secondary',
    };
  }, [
    checkForUpdatesStatus,
    updateInfo,
    progress,
    finished,
    hasCheckedForUpdates,
    isDownloading,
    handleCheckForUpdates,
    handleDownloadUpdate,
    handleInstallUpdate,
  ]);

  const canInstallNewVersion = useMemo(
    () => updateInfo.available && updateInfo.isDownloaded && hasCheckedForUpdates,
    [updateInfo.available, updateInfo.isDownloaded, hasCheckedForUpdates],
  );

  const buttonProps = getButtonProps();

  const renderStatusMessage = () => {
    if (shouldShowUpdateAvailable() && releaseNotes) {
      return (
        <Typography
          variant="h6"
          className="update-settings__release-notes-header"
        >
          {t('modal.app_settings.update.update_available')}: v{releaseNotes.version}
        </Typography>
      );
    }

    if (progress > 0 && !finished) {
      return (
        <Box className="update-settings__progress-container">
          <Typography variant="body2">{t('modal.app_settings.update.applying')}</Typography>
          <Typography variant="body2">{t('modal.app_settings.update.dont_close')}</Typography>
        </Box>
      );
    }

    if (
      hasCheckedForUpdates &&
      updateInfo.available === false &&
      checkForUpdatesStatus === 'succeeded'
    ) {
      return (
        <Typography
          variant="subtitle1"
          className="update-settings__up-to-date-message"
        >
          {t('modal.app_settings.version.up_to_date')}
        </Typography>
      );
    }

    return null;
  };

  const renderReleaseNotes = () => {
    if (!shouldShowUpdateAvailable() || !releaseNotes || !releaseNotes.content.length) {
      return null;
    }

    return (
      <Box className="update-settings__release-notes">
        <Box className="update-settings__release-notes-content">
          {releaseNotes.content.length > 0 && (
            <Box className="update-settings__release-notes-section">
              <MarkdownRenderer content={releaseNotes.content} />
            </Box>
          )}
        </Box>
      </Box>
    );
  };

  return (
    <Column className={`update-settings ${className}`}>
      <Box className="update-settings__status-area">
        {renderStatusMessage()}
        {renderReleaseNotes()}
      </Box>
      <Box className="update-settings__button-area">
        <Button
          variant="contained"
          color={buttonProps.color}
          onClick={buttonProps.action}
          disabled={buttonProps.disabled}
          fullWidth
        >
          {buttonProps.text}
        </Button>
        {canInstallNewVersion && (
          <Row className="update-settings__message-container">
            <InfoOutlined />
            <Typography variant="body2">{t('modal.app_settings.update.auto_restart')}</Typography>
          </Row>
        )}
      </Box>
    </Column>
  );
};
