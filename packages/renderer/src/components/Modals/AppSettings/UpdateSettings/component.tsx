import { useCallback, useMemo, useState } from 'react';
import { Box, Typography, Button } from 'decentraland-ui2';
import { InfoOutlined } from '@mui/icons-material';
import { Row } from '../../../Row';
import { Column } from '../../../Column';
import { t } from '/@/modules/store/translation/utils';
import { useEditor } from '/@/hooks/useEditor';
import { useDispatch, useSelector } from '#store';
import { checkForUpdates, downloadUpdate, installUpdate } from '/@/modules/store/settings/slice';
import './styles.css';

interface UpdateButtonProps {
  action: () => void;
  text: string;
  disabled?: boolean;
}

export const UpdateSettings: React.FC<{ className?: string }> = ({ className = '' }) => {
  const dispatch = useDispatch();
  const { version: currentVersion } = useEditor();
  const {
    downloadingUpdate: { progress, finished },
    updateInfo,
  } = useSelector(state => state.settings);
  const [hasCheckedForUpdates, setHasCheckedForUpdates] = useState(false);

  const handleCheckForUpdates = useCallback(async () => {
    setHasCheckedForUpdates(true);
    dispatch(checkForUpdates({ autoDownload: false }));
  }, [dispatch]);

  const handleInstallUpdate = useCallback(async () => {
    dispatch(installUpdate());
  }, []);

  const handleDownloadUpdate = useCallback(async () => {
    dispatch(downloadUpdate());
  }, [handleCheckForUpdates]);

  const getButtonProps = useCallback((): UpdateButtonProps => {
    if (progress > 0 && !finished) {
      return {
        action: () => {},
        text: t('modal.app_settings.update.downloading', { progress }),
        disabled: true,
      };
    }
    if (!hasCheckedForUpdates) {
      return {
        action: handleCheckForUpdates,
        text: t('modal.app_settings.update.check'),
      };
    }
    if (updateInfo.available) {
      return {
        action: updateInfo.isInstalled ? handleInstallUpdate : handleDownloadUpdate,
        text: updateInfo.isInstalled
          ? t('modal.app_settings.update.install')
          : t('modal.app_settings.update.update'),
      };
    }
    return {
      action: handleCheckForUpdates,
      text: t('modal.app_settings.update.check'),
    };
  }, [
    updateInfo,
    progress,
    finished,
    hasCheckedForUpdates,
    handleCheckForUpdates,
    handleDownloadUpdate,
    handleInstallUpdate,
  ]);

  const canInstallNewVersion = useMemo(
    () => updateInfo.available && updateInfo.isInstalled,
    [updateInfo.available, updateInfo.isInstalled],
  );

  const buttonProps = getButtonProps();

  return (
    <Column className={`update-settings ${className}`}>
      {currentVersion && (
        <Typography variant="body1">
          {t('modal.app_settings.version.current', { version: currentVersion })}
        </Typography>
      )}
      <Row className="update-settings__button-container">
        <Button
          variant="contained"
          onClick={buttonProps.action}
          disabled={buttonProps.disabled}
        >
          {buttonProps.text}
        </Button>
        {hasCheckedForUpdates && updateInfo.available && progress === 0 && updateInfo.version && (
          <Typography variant="subtitle1">
            {t('modal.app_settings.version.new', { version: updateInfo.version })}
          </Typography>
        )}
        {progress > 0 && !finished && (
          <Box className="update-settings__progress-container">
            <Typography variant="body2">{t('modal.app_settings.update.applying')}</Typography>
            <Typography variant="body2">{t('modal.app_settings.update.dont_close')}</Typography>
          </Box>
        )}
        {hasCheckedForUpdates && updateInfo.available === false && (
          <Typography variant="subtitle1">{t('modal.app_settings.version.up_to_date')}</Typography>
        )}
      </Row>
      {canInstallNewVersion && (
        <Row className="update-settings__message-container">
          <InfoOutlined />
          <Typography variant="body2">{t('modal.app_settings.update.auto_restart')}</Typography>
        </Row>
      )}
    </Column>
  );
};
