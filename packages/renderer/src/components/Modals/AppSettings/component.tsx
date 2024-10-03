import { useCallback, useEffect, useState } from 'react';
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
import { Modal } from 'decentraland-ui2/dist/components/Modal/Modal';
import { settings as settingsPreload } from '#preload';
import { UPDATE_DEPENDENCIES_STRATEGY } from '/shared/types/settings';
import { t } from '/@/modules/store/translation/utils';
import { useSettings } from '/@/hooks/useSettings';

import './styles.css';

export function AppSettings({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useSettings();
  const [scenesPath, setScenesPath] = useState('');
  const [updateDependenciesStrategy, setUpdateDependenciesStrategy] =
    useState<UPDATE_DEPENDENCIES_STRATEGY>(UPDATE_DEPENDENCIES_STRATEGY.NOTIFY);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    const checkIfDirty = async () => {
      const scenesPathSetting = settings.scenesPath;
      const updateStrategySetting = settings.updateDependenciesStrategy;

      setIsDirty(
        scenesPath !== scenesPathSetting || updateDependenciesStrategy !== updateStrategySetting,
      );
    };

    checkIfDirty();
  }, [scenesPath, updateDependenciesStrategy]);

  const handleChangeSceneFolder = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setScenesPath(event.target.value);
  }, []);

  const handleClickChangeSceneFolder = useCallback(() => {
    settings.setScenesPath(scenesPath);
    onClose();
  }, [scenesPath]);

  const handleChangeUpdateDependenciesStrategy = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value as UPDATE_DEPENDENCIES_STRATEGY;
      setUpdateDependenciesStrategy(value);
    },
    [],
  );

  const handleClickApply = useCallback(async () => {
    await settings.setScenesPath(scenesPath);
    await settings.setUpdateDependenciesStrategy(updateDependenciesStrategy);
    onClose();
  }, [scenesPath, updateDependenciesStrategy]);

  const handleOpenFolder = useCallback(async () => {
    const folder = await settingsPreload.selectSceneFolder();
    if (folder) {
      setScenesPath(folder);
    }
  }, []);

  useEffect(() => {
    const path = settings.scenesPath;
    const strategy = settings.updateDependenciesStrategy;
    setScenesPath(path);
    setUpdateDependenciesStrategy(strategy);
  }, [settings.scenesPath, settings.updateDependenciesStrategy]);

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
        <Box className="FormContainer">
          <FormGroup className="ScenesFolderFormControl">
            <Typography variant="body1">
              {t('modal.app_settings.fields.scenes_folder.label')}
            </Typography>
            <OutlinedInput
              color="secondary"
              value={scenesPath}
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
            <Button
              className="ChangeSceneFolderButton"
              variant="contained"
              color="secondary"
              disableRipple
              onClick={handleClickChangeSceneFolder}
            >
              {t('modal.app_settings.fields.scenes_folder.change_button')}
            </Button>
          </FormGroup>
          <FormGroup sx={{ gap: '16px' }}>
            <Typography variant="body1">
              {t('modal.app_settings.fields.scene_editor_dependencies.label')}
            </Typography>
            <RadioGroup
              value={updateDependenciesStrategy}
              onChange={handleChangeUpdateDependenciesStrategy}
            >
              <FormControlLabel
                value={UPDATE_DEPENDENCIES_STRATEGY.AUTO_UPDATE}
                control={<Radio />}
                label={t('modal.app_settings.fields.scene_editor_dependencies.options.auto_update')}
              />
              <FormControlLabel
                value={UPDATE_DEPENDENCIES_STRATEGY.NOTIFY}
                control={<Radio />}
                label={t('modal.app_settings.fields.scene_editor_dependencies.options.notify')}
              />
              <FormControlLabel
                value={UPDATE_DEPENDENCIES_STRATEGY.DO_NOTHING}
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
