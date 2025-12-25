import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Typography, Button } from 'decentraland-ui2';
import { InfoOutlined } from '@mui/icons-material';
import { t } from '/@/modules/store/translation/utils';
import { useDispatch, useSelector } from '#store';
import { checkForUpdates, downloadUpdate, installUpdate } from '/@/modules/store/settings/slice';
import { Row } from '../../../Row';
import { Column } from '../../../Column';
import { settings as settingsPreload } from '#preload';
import type { ReleaseNotes } from '/shared/types/settings';

import './styles.css';

interface UpdateButtonProps {
  action: () => void;
  text: string;
  disabled?: boolean;
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
        setReleaseNotes(notes);
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
      };
    }

    if (progress > 0 && !finished) {
      return {
        action: () => {},
        text: t('modal.app_settings.update.downloading', { progress }),
        disabled: true,
      };
    }

    if (!hasCheckedForUpdates || checkForUpdatesStatus === 'idle') {
      return {
        action: handleCheckForUpdates,
        text: t('modal.app_settings.update.check'),
      };
    }

    if (updateInfo.available) {
      const buttonText = updateInfo.isDownloaded
        ? t('modal.app_settings.update.install')
        : t('modal.app_settings.update.update');

      return {
        action: updateInfo.isDownloaded ? handleInstallUpdate : handleDownloadUpdate,
        text: buttonText,
      };
    }

    return {
      action: handleCheckForUpdates,
      text: t('modal.app_settings.update.check'),
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
    if (shouldShowUpdateAvailable()) {
      return (
        <Typography variant="subtitle1">
          {t('modal.app_settings.version.new', { version: updateInfo.version })}
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
        <Typography variant="subtitle1">{t('modal.app_settings.version.up_to_date')}</Typography>
      );
    }

    return null;
  };

  const renderReleaseNotes = () => {
    if (
      !shouldShowUpdateAvailable() ||
      !releaseNotes ||
      (!releaseNotes.whatsNew.length && !releaseNotes.bugFixes.length)
    ) {
      return null;
    }

    return (
      <Box className="update-settings__release-notes">
        <Typography
          variant="h6"
          className="update-settings__release-notes-header"
        >
          {t('modal.app_settings.update.update_available')}: v{releaseNotes.version}
        </Typography>
        <Box className="update-settings__release-notes-content">
          {releaseNotes.whatsNew.length > 0 && (
            <Box className="update-settings__release-notes-section">
              <Typography
                variant="subtitle1"
                className="update-settings__section-title"
              >
                {t('modal.app_settings.update.whats_new')}
              </Typography>
              <ul className="update-settings__notes-list">
                {releaseNotes.whatsNew.map((item, index) => (
                  <li key={index}>
                    <Typography variant="body2">{item}</Typography>
                  </li>
                ))}
              </ul>
            </Box>
          )}
          {releaseNotes.bugFixes.length > 0 && (
            <Box className="update-settings__release-notes-section">
              <Typography
                variant="subtitle1"
                className="update-settings__section-title"
              >
                {t('modal.app_settings.update.bug_fixes')}
              </Typography>
              <ul className="update-settings__notes-list">
                {releaseNotes.bugFixes.map((item, index) => (
                  <li key={index}>
                    <Typography variant="body2">{item}</Typography>
                  </li>
                ))}
              </ul>
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
          color="secondary"
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
