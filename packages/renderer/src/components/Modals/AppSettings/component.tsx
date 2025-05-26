import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  IconButton,
  FormControlLabel,
  Radio,
  RadioGroup,
  OutlinedInput,
  Typography,
  FormGroup,
  InputAdornment,
  Button,
} from 'decentraland-ui2';
import CloseIcon from '@mui/icons-material/Close';
import FolderIcon from '@mui/icons-material/Folder';
import equal from 'fast-deep-equal';

import { settings as settingsPreload } from '#preload';

import { DEPENDENCY_UPDATE_STRATEGY } from '/shared/types/settings';

import { t } from '/@/modules/store/translation/utils';
import { useSettings } from '/@/hooks/useSettings';
import { useEditor } from '/@/hooks/useEditor';

import { Modal } from '..';
import './styles.css';
import { InfoOutlined } from '@mui/icons-material';
import { Row } from '../../Row';
import { Column } from '../../Column';
import type { IpcRendererEvent } from 'electron';

export function AppSettings({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings: _settings, updateAppSettings } = useSettings();
  const [downloadProgress, setDownloadProgress] = useState({ progress: 0, finished: false });
  const { version: currentVersion } = useEditor();
  const [updateInfo, setUpdateInfo] = useState<{
    available: boolean | null;
    version: string | null;
    isInstalled: boolean | null;
  }>({ available: null, version: null, isInstalled: null });
  const [settings, setSettings] = useState(_settings);

  useEffect(() => {
    if (!equal(_settings, settings)) setSettings(_settings);
  }, [_settings]);

  const handleChangeSceneFolder = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setSettings({ ...settings, scenesPath: event.target.value });
    },
    [settings],
  );

  const handleChangeUpdateDependenciesStrategy = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setSettings({
        ...settings,
        dependencyUpdateStrategy: event.target.value as DEPENDENCY_UPDATE_STRATEGY,
      });
    },
    [settings],
  );

  const handleClickApply = useCallback(() => {
    updateAppSettings(settings);
    onClose();
  }, [settings, updateAppSettings]);

  const handleOpenFolder = useCallback(async () => {
    const folder = await settingsPreload.selectSceneFolder();
    if (folder) setSettings({ ...settings, scenesPath: folder });
  }, [settings]);

  const isDirty = useMemo(() => !equal(_settings, settings), [settings, _settings]);

  const handleCheckForUpdates = useCallback(async () => {
    const { updateAvailable, version: newVersion } = await settingsPreload.checkForUpdates({
      autoDownload: false,
    });
    const downloadedVersion = await settingsPreload.getDownloadedVersion();
    setUpdateInfo({
      available: !!updateAvailable,
      version: newVersion ?? null,
      isInstalled: !!downloadedVersion && downloadedVersion === newVersion,
    });
  }, []);

  const handleInstallUpdate = useCallback(async () => {
    await settingsPreload.quitAndInstall();
  }, []);

  const handleDownloadState = useCallback(
    (_event: IpcRendererEvent, progress: { percent: number; finished: boolean }) => {
      const { percent, finished } = progress;
      setDownloadProgress({ progress: percent, finished });
    },
    [],
  );

  const handleDownloadUpdate = useCallback(async () => {
    try {
      settingsPreload.downloadUpdate();
      settingsPreload.downloadState(handleDownloadState);
      handleCheckForUpdates();
    } catch (error) {
      console.error('Error downloading update:', error);
    }
  }, [handleCheckForUpdates]);

  const canInstallNewVersion = useMemo(
    () => updateInfo.available && updateInfo.isInstalled,
    [updateInfo.available, updateInfo.isInstalled],
  );

  const getButtonProps = useCallback(() => {
    if (downloadProgress.progress > 0 && !downloadProgress.finished) {
      return {
        action: () => {},
        text: t('modal.app_settings.update.downloading', { progress: downloadProgress.progress }),
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
    updateInfo.available,
    updateInfo.isInstalled,
    handleInstallUpdate,
    handleDownloadUpdate,
    handleCheckForUpdates,
    downloadProgress.progress,
    downloadProgress.finished,
  ]);

  return (
    <Modal
      open={open}
      size="small"
    >
      <Box className="AppSettingsModal">
        <Box className="CloseButtonContainer">
          <IconButton onClick={onClose}>
            <CloseIcon fontSize="large" />
          </IconButton>
        </Box>
        <Box>
          <Typography variant="h4">{t('modal.app_settings.title')}</Typography>
        </Box>
        <Column className="UpdateContainer">
          <Typography variant="body1">
            {t('modal.app_settings.version.current', { version: currentVersion })}
          </Typography>
          <Row className="UpdateButtonContainer">
            <Button
              variant="contained"
              onClick={getButtonProps().action}
              disabled={downloadProgress.progress > 0 && !downloadProgress.finished}
            >
              {getButtonProps().text}
            </Button>
            {updateInfo.available && downloadProgress.progress === 0 && (
              <Typography variant="subtitle1">
                {t('modal.app_settings.version.new', { version: updateInfo.version })}
              </Typography>
            )}
            {downloadProgress.progress > 0 && !downloadProgress.finished && (
              <Box className="DownloadProgressContainer">
                <Typography variant="body2">{t('modal.app_settings.update.applying')}</Typography>
                <Typography variant="body2">{t('modal.app_settings.update.dont_close')}</Typography>
              </Box>
            )}
            {updateInfo.available === false && (
              <Typography variant="subtitle1">
                {t('modal.app_settings.version.up_to_date')}
              </Typography>
            )}
          </Row>
          {canInstallNewVersion && (
            <Row className="MessageContainer">
              <InfoOutlined />
              <Typography variant="body2">{t('modal.app_settings.update.auto_restart')}</Typography>
            </Row>
          )}
        </Column>
        <Box className="FormContainer">
          <FormGroup className="ScenesFolderFormControl">
            <Typography variant="body1">
              {t('modal.app_settings.fields.scenes_folder.label')}
            </Typography>
            <OutlinedInput
              color="secondary"
              value={settings.scenesPath}
              onChange={handleChangeSceneFolder}
              endAdornment={
                <InputAdornment position="end">
                  <IconButton
                    onClick={handleOpenFolder}
                    edge="end"
                  >
                    <FolderIcon />
                  </IconButton>
                </InputAdornment>
              }
            />
          </FormGroup>
          <FormGroup sx={{ gap: '16px' }}>
            <Typography variant="body1">
              {t('modal.app_settings.fields.scene_editor_dependencies.label')}
            </Typography>
            <RadioGroup
              value={settings.dependencyUpdateStrategy}
              onChange={handleChangeUpdateDependenciesStrategy}
            >
              <FormControlLabel
                value={DEPENDENCY_UPDATE_STRATEGY.AUTO_UPDATE}
                control={<Radio />}
                label={t('modal.app_settings.fields.scene_editor_dependencies.options.auto_update')}
              />
              <FormControlLabel
                value={DEPENDENCY_UPDATE_STRATEGY.NOTIFY}
                control={<Radio />}
                label={t('modal.app_settings.fields.scene_editor_dependencies.options.notify')}
              />
              <FormControlLabel
                value={DEPENDENCY_UPDATE_STRATEGY.DO_NOTHING}
                control={<Radio />}
                label={t('modal.app_settings.fields.scene_editor_dependencies.options.do_nothing')}
              />
            </RadioGroup>
          </FormGroup>
          <Button
            className="ApplyButton"
            variant="contained"
            disabled={!isDirty}
            onClick={handleClickApply}
          >
            {t('modal.app_settings.actions.apply_button')}
          </Button>
        </Box>
      </Box>
    </Modal>
  );
}
