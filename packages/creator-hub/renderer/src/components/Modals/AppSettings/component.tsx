import { useCallback, useEffect, useMemo, useState } from 'react';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import FolderIcon from '@mui/icons-material/Folder';
import equal from 'fast-deep-equal';
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
  Select,
  MenuItem,
  CircularProgress,
} from 'decentraland-ui2';
import { loadEditors, setDefaultEditor } from '/@/modules/store/editors';

import { DEPENDENCY_UPDATE_STRATEGY } from '/shared/types/settings';
import { t } from '/@/modules/store/translation/utils';
import { useSettings } from '/@/hooks/useSettings';
import { Modal } from '..';
import { UpdateSettings } from './UpdateSettings';
import { useDispatch, useSelector } from '#store';
import { settings as settingsPreload } from '#preload';
import './styles.css';

export function AppSettings({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dispatch = useDispatch();
  const { settings: _settings, updateAppSettings } = useSettings();
  const [settings, setSettings] = useState(_settings);
  const { editors, loading } = useSelector(state => state.editors);

  useEffect(() => {
    dispatch(loadEditors());
  }, [dispatch]);

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
        <UpdateSettings />
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
          <FormGroup>
            <Typography variant="body1">
              {t('modal.app_settings.fields.code_editor.label')}
            </Typography>
            {loading ? (
              <CircularProgress size={24} />
            ) : (
              <Select
                value={editors.find(e => e.isDefault)?.path || ''}
                className="editor-select"
                onChange={event => {
                  const selectedPath = event.target.value;
                  if (selectedPath) {
                    dispatch(setDefaultEditor(selectedPath));
                  }
                }}
              >
                {editors.map(editor => (
                  <MenuItem
                    key={editor.path}
                    value={editor.path}
                  >
                    {editor.name}
                    {editor.isDefault && <CheckIcon className="default-icon" />}
                  </MenuItem>
                ))}
                <MenuItem
                  value="custom"
                  className="custom-editor"
                  onClick={async () => {
                    const [editorPath] = await settingsPreload.selectEditorPath();
                    if (editorPath) {
                      dispatch(setDefaultEditor(editorPath));
                    }
                  }}
                >
                  {t('modal.app_settings.fields.code_editor.choose_device')}
                </MenuItem>
              </Select>
            )}
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
