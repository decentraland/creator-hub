import { useCallback, useEffect, useState } from 'react';
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
  Select,
  MenuItem,
  CircularProgress,
} from 'decentraland-ui2';
import { loadEditors, setDefaultEditor } from '/@/modules/store/defaultEditor';

import { DEPENDENCY_UPDATE_STRATEGY } from '/shared/types/settings';
import type { EditorConfig } from '/shared/types/config';

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
  const { editors, loading } = useSelector(state => state.defaultEditor);

  useEffect(() => {
    if (open) {
      dispatch(loadEditors());
    }
  }, [dispatch, open]);

  useEffect(() => {
    if (!equal(_settings, settings)) setSettings(_settings);
  }, [_settings]);

  const handleChangeSceneFolder = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newSettings = { ...settings, scenesPath: event.target.value };
      setSettings(newSettings);
      updateAppSettings(newSettings);
    },
    [settings, updateAppSettings],
  );

  const handleChangeUpdateDependenciesStrategy = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newSettings = {
        ...settings,
        dependencyUpdateStrategy: event.target.value as DEPENDENCY_UPDATE_STRATEGY,
      };
      setSettings(newSettings);
      updateAppSettings(newSettings);
    },
    [settings, updateAppSettings],
  );

  const handleOpenFolder = useCallback(async () => {
    const folder = await settingsPreload.selectSceneFolder();
    if (folder) {
      const newSettings = { ...settings, scenesPath: folder };
      setSettings(newSettings);
      updateAppSettings(newSettings);
    }
  }, [settings, updateAppSettings]);

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
          <FormGroup
            sx={{ gap: '16px' }}
            className="editor-form"
          >
            <Typography variant="body1">
              {t('modal.app_settings.fields.code_editor.label')}
            </Typography>
            {loading ? (
              <CircularProgress size={24} />
            ) : (
              <Select
                fullWidth
                displayEmpty
                value={editors?.find(e => e.isDefault)?.path || ''}
                renderValue={value =>
                  editors?.find(e => e.path === value)?.name || 'Add or select a default editor'
                }
                onChange={event => {
                  const selectedPath = event.target.value;
                  if (selectedPath) {
                    dispatch(setDefaultEditor(selectedPath));
                  }
                }}
              >
                {(editors || []).map((editor: EditorConfig) => (
                  <MenuItem
                    key={editor.path}
                    value={editor.path}
                    className="editor-select"
                  >
                    <span>{editor.name}</span>
                    {editor.isDefault && <CheckIcon className="default-icon menu-only" />}
                  </MenuItem>
                ))}
                <MenuItem
                  className="custom-editor"
                  onMouseDown={async (e: React.MouseEvent) => {
                    e.preventDefault();
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
        </Box>
      </Box>
    </Modal>
  );
}
