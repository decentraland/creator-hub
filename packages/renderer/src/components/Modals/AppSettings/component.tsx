import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  FormControlLabel,
  Radio,
  RadioGroup,
  OutlinedInput,
  Typography,
  FormGroup,
  InputAdornment,
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

export function AppSettings({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings: _settings, updateAppSettings } = useSettings();
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
    const { updateAvailable, version: newVersion } = await settingsPreload.getUpdateInfo();
    const downloadedVersion = await settingsPreload.getDownloadedVersion();
    setUpdateInfo({
      available: !!updateAvailable,
      version: newVersion ?? null,
      isInstalled: !!downloadedVersion && downloadedVersion === newVersion,
    });
  }, []);

  const handleInstallUpdate = useCallback(async () => {
    console.log('install update');
  }, []);

  const handleDownloadUpdate = useCallback(async () => {
    console.log('download update');
  }, []);

  const canInstallNewVersion = useMemo(
    () => updateInfo.available && updateInfo.isInstalled,
    [updateInfo.available, updateInfo.isInstalled],
  );

  const getButtonProps = useCallback(() => {
    if (updateInfo.available) {
      return {
        action: updateInfo.isInstalled ? handleInstallUpdate : handleDownloadUpdate,
        text: updateInfo.isInstalled ? 'Install now' : 'Update now',
      };
    }
    return {
      action: handleCheckForUpdates,
      text: 'Check for updates',
    };
  }, [
    updateInfo.available,
    updateInfo.isInstalled,
    handleInstallUpdate,
    handleDownloadUpdate,
    handleCheckForUpdates,
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
          <Typography variant="body1">Current Version: {currentVersion}</Typography>
          <Row className="UpdateButtonContainer">
            <Button
              variant="contained"
              onClick={getButtonProps().action}
            >
              {getButtonProps().text}
            </Button>
            {updateInfo.available && (
              <Typography variant="subtitle1">New version: {updateInfo.version}</Typography>
            )}
            {updateInfo.available === false && (
              <Typography variant="subtitle1">Creator Hub is up to date</Typography>
            )}
          </Row>
          {canInstallNewVersion && (
            <Row className="MessageContainer">
              <InfoOutlined />
              <Typography variant="body2">
                Creator Hub will auto-restart after the update.
              </Typography>
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
