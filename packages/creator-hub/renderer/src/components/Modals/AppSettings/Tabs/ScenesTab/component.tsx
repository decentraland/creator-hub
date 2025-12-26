import { useCallback } from 'react';
import FolderIcon from '@mui/icons-material/Folder';
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

import { DEPENDENCY_UPDATE_STRATEGY } from '/shared/types/settings';
import { t } from '/@/modules/store/translation/utils';
import type { ScenesTabProps } from '../../types';

import './styles.css';

const ScenesTab: React.FC<ScenesTabProps> = ({
  settings,
  updateSettings,
  error,
  isCustomScenesPath,
  onOpenFolder,
  onResetScenesFolder,
  onValidateScenesPath,
}) => {
  const handleChangeSceneFolder = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newSettings = { ...settings, scenesPath: event.target.value };
      updateSettings(newSettings);
      onValidateScenesPath(newSettings.scenesPath);
    },
    [settings, updateSettings, onValidateScenesPath],
  );

  const handleChangeUpdateDependenciesStrategy = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newSettings = {
        ...settings,
        dependencyUpdateStrategy: event.target.value as DEPENDENCY_UPDATE_STRATEGY,
      };
      updateSettings(newSettings);
    },
    [settings, updateSettings],
  );

  return (
    <Box className="FormContainer">
      <FormGroup className="ScenesFolderFormControl">
        <Typography variant="body1">
          {t('modal.app_settings.fields.scenes_folder.label')}
        </Typography>
        <Box className="ScenesFolderInputContainer">
          <OutlinedInput
            color="secondary"
            value={settings.scenesPath}
            onChange={handleChangeSceneFolder}
            error={!!error}
            fullWidth
            endAdornment={
              <InputAdornment
                position="end"
                className="ScenesFolderInputAdornment"
              >
                {isCustomScenesPath && (
                  <Button
                    variant="text"
                    color="secondary"
                    onClick={onResetScenesFolder}
                    className="ResetScenesFolderButton"
                  >
                    {t('modal.app_settings.fields.scenes_folder.reset_button')}
                  </Button>
                )}
                <IconButton
                  onClick={onOpenFolder}
                  edge="end"
                >
                  <FolderIcon />
                </IconButton>
              </InputAdornment>
            }
          />
        </Box>
        {error && (
          <Typography
            variant="body1"
            className="error"
          >
            {error}
          </Typography>
        )}
      </FormGroup>
      <FormGroup className="DependencyUpdateFormGroup">
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
    </Box>
  );
};

export default ScenesTab;
