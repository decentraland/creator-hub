import { useCallback, useEffect, useState } from 'react';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import FolderIcon from '@mui/icons-material/Folder';
import DeleteIcon from '@mui/icons-material/Delete';
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
import {
  loadEditors,
  setDefaultEditor,
  addEditor,
  removeEditor,
  getEditors,
} from '/@/modules/store/defaultEditor';

import { DEPENDENCY_UPDATE_STRATEGY } from '/shared/types/settings';
import type { EditorConfig } from '/shared/types/config';
import { debounce } from '/shared/utils';

import { t } from '/@/modules/store/translation/utils';
import { useSettings } from '/@/hooks/useSettings';
import { useWorkspace } from '/@/hooks/useWorkspace';
import { Modal } from '..';
import { UpdateSettings } from './UpdateSettings';
import { useDispatch, useSelector } from '#store';
import { settings as settingsPreload } from '#preload';
import './styles.css';

export function AppSettings({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dispatch = useDispatch();
  const { settings: _settings, updateAppSettings } = useSettings();
  const { validateScenesPath } = useWorkspace();
  const [settings, setSettings] = useState(_settings);
  const [error, setError] = useState<string | null>(null);
  const { loading } = useSelector(state => state.defaultEditor);
  const editors = useSelector(getEditors);

  useEffect(() => {
    if (open) {
      dispatch(loadEditors());
    }
  }, [dispatch, open]);

  useEffect(() => {
    if (open) {
      validateScenesPathField(settings.scenesPath);
    } else {
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!equal(_settings, settings)) setSettings(_settings);
  }, [_settings]);

  const validateScenesPathField = useCallback(
    debounce(async (path: string) => {
      const isValid = await validateScenesPath(path);
      setError(!isValid ? t('modal.app_settings.fields.scenes_folder.errors.invalid_path') : null);
    }, 500),
    [validateScenesPath],
  );

  const handleChangeSceneFolder = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const newSettings = { ...settings, scenesPath: event.target.value };
      setSettings(newSettings);
      updateAppSettings(newSettings);
      validateScenesPathField(newSettings.scenesPath);
    },
    [settings, updateAppSettings, validateScenesPath],
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
      validateScenesPathField(newSettings.scenesPath);
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
              error={!!error}
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
            {error && (
              <Typography
                variant="body1"
                className="error"
              >
                {error}
              </Typography>
            )}
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
                value={(editors && editors.find(e => e.isDefault)?.path) || ''}
                renderValue={value =>
                  (editors && editors.find(e => e.path === value)?.name) ||
                  'Add or select a default editor'
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
                    <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
                      {editor.isDefault && <CheckIcon className="default-icon menu-only" />}
                      <IconButton
                        size="small"
                        onClick={e => {
                          e.stopPropagation();
                          dispatch(removeEditor(editor.path));
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </MenuItem>
                ))}
                <MenuItem
                  className="custom-editor"
                  onMouseDown={async (e: React.MouseEvent) => {
                    e.preventDefault();
                    const [editorPath] = await settingsPreload.selectEditorPath();
                    if (editorPath) {
                      dispatch(addEditor(editorPath));
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
