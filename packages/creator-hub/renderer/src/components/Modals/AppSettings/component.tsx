import { useCallback, useEffect, useState } from 'react';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import FolderIcon from '@mui/icons-material/Folder';
import DeleteIcon from '@mui/icons-material/Delete';
import SettingsIcon from '@mui/icons-material/Settings';
import equal from 'fast-deep-equal';
import {
  Box,
  Button,
  Checkbox,
  IconButton,
  FormControlLabel,
  Link,
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
import { useEditor } from '/@/hooks/useEditor';
import { useDispatch, useSelector } from '#store';
import { settings as settingsPreload, misc } from '#preload';
import { Modal } from '..';
import { UpdateSettings } from './UpdateSettings';
import logo from '/assets/images/logo-editor.png';
import './styles.css';

const GITHUB_RELEASES_URL = 'https://github.com/decentraland/creator-hub/releases';

enum SettingsTab {
  SCENES = 'scenes',
  EDITOR = 'editor',
  ABOUT = 'about',
}

export function AppSettings({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dispatch = useDispatch();
  const { settings: _settings, updateAppSettings } = useSettings();
  const { validateProjectPath } = useWorkspace();
  const { version } = useEditor();
  const [settings, setSettings] = useState(_settings);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>(SettingsTab.SCENES);
  const [isCustomScenesPath, setIsCustomScenesPath] = useState(false);
  const { loading } = useSelector(state => state.defaultEditor);
  const editors = useSelector(getEditors);

  useEffect(() => {
    if (open) {
      dispatch(loadEditors());
      validateScenesPathField(settings.scenesPath);
      settingsPreload.isCustomScenesPath(settings.scenesPath).then(setIsCustomScenesPath);
    }
  }, [dispatch, open]);

  useEffect(() => {
    settingsPreload.isCustomScenesPath(settings.scenesPath).then(setIsCustomScenesPath);
  }, [settings.scenesPath]);

  useEffect(() => {
    if (!equal(_settings, settings)) setSettings(_settings);
  }, [_settings]);

  const validateScenesPathField = useCallback(
    debounce(async (path: string) => {
      const isValid = await validateProjectPath(path);
      setError(!isValid ? t('modal.app_settings.fields.scenes_folder.errors.invalid_path') : null);
    }, 500),
    [validateProjectPath],
  );

  const handleChangeSceneFolder = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newSettings = { ...settings, scenesPath: event.target.value };
      setSettings(newSettings);
      updateAppSettings(newSettings);
      validateScenesPathField(newSettings.scenesPath);
    },
    [settings, updateAppSettings, validateProjectPath],
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

  const handleResetScenesFolder = useCallback(async () => {
    const defaultPath = await settingsPreload.getDefaultScenesPath();
    const newSettings = { ...settings, scenesPath: defaultPath };
    setSettings(newSettings);
    updateAppSettings(newSettings);
    validateScenesPathField(defaultPath);
  }, [settings, updateAppSettings, validateScenesPathField]);

  const handleViewChangelog = useCallback(() => {
    const releaseUrl = version ? `${GITHUB_RELEASES_URL}/tag/${version}` : GITHUB_RELEASES_URL;
    misc.openExternal(releaseUrl);
  }, [version]);

  const renderScenesTab = () => (
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
                sx={{ display: 'flex', gap: 1, alignItems: 'center', mr: 1 }}
              >
                {isCustomScenesPath && (
                  <Button
                    variant="outlined"
                    color="secondary"
                    onClick={handleResetScenesFolder}
                    className="ResetScenesFolderButton"
                  >
                    {t('modal.app_settings.fields.scenes_folder.reset_button')}
                  </Button>
                )}
                <IconButton
                  onClick={handleOpenFolder}
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
  );

  const renderEditorTab = () => (
    <Box className="FormContainer">
      <FormGroup
        sx={{ gap: '16px' }}
        className="editor-form"
      >
        <Typography variant="body1">{t('modal.app_settings.fields.code_editor.label')}</Typography>
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
      <FormGroup sx={{ gap: '4px' }}>
        <Typography variant="body1">{t('editor.header.actions.preview_options.title')}</Typography>
        <FormControlLabel
          control={
            <Checkbox
              checked={!!settings.previewOptions.debugger}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                const newSettings = {
                  ...settings,
                  previewOptions: {
                    ...settings.previewOptions,
                    debugger: event.target.checked,
                  },
                };
                setSettings(newSettings);
                updateAppSettings(newSettings);
              }}
            />
          }
          label={t('editor.header.actions.preview_options.debugger')}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={!!settings.previewOptions.enableLandscapeTerrains}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                const newSettings = {
                  ...settings,
                  previewOptions: {
                    ...settings.previewOptions,
                    enableLandscapeTerrains: event.target.checked,
                  },
                };
                setSettings(newSettings);
                updateAppSettings(newSettings);
              }}
            />
          }
          label={t('editor.header.actions.preview_options.landscape_terrain_enabled')}
        />
      </FormGroup>
      <FormGroup sx={{ gap: '16px' }}>
        <Typography variant="body1">{t('modal.app_settings.fields.app_warnings.label')}</Typography>
        <FormControlLabel
          control={
            <Checkbox
              checked={!!settings.previewOptions.showWarnings}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                const newSettings = {
                  ...settings,
                  previewOptions: {
                    ...settings.previewOptions,
                    showWarnings: event.target.checked,
                  },
                };
                setSettings(newSettings);
                updateAppSettings(newSettings);
              }}
            />
          }
          label={t('modal.app_settings.fields.app_warnings.show_warnings')}
        />
      </FormGroup>
    </Box>
  );

  const renderAboutTab = () => (
    <Box className="AboutTabContainer">
      <Box className="AboutHeader">
        <img
          src={logo}
          alt="Decentraland Creator Hub"
          className="AboutLogo"
        />
        <Box className="AboutInfo">
          <Typography
            variant="h5"
            className="AboutTitle"
          >
            {t('modal.app_settings.about.title')}
          </Typography>
          <Box className="AboutVersionRow">
            <Typography
              variant="body2"
              className="AboutVersion"
            >
              v{version}
            </Typography>
            <Link
              component="button"
              onClick={handleViewChangelog}
              className="AboutChangelogLink"
            >
              {t('modal.app_settings.about.view_changelog')}
            </Link>
          </Box>
        </Box>
      </Box>
      <Box className="AboutUpdateSection">
        <UpdateSettings className="AboutUpdateSettings" />
      </Box>
    </Box>
  );

  return (
    <Modal
      open={open}
      size="small"
    >
      <Box className="AppSettingsModal">
        <Box className="SettingsHeader">
          <Box className="SettingsHeaderTitle">
            <SettingsIcon />
            <Typography variant="h6">{t('modal.app_settings.title')}</Typography>
          </Box>
          <IconButton onClick={onClose}>
            <CloseIcon
              fontSize="medium"
              style={{ color: 'var(--white)' }}
            />
          </IconButton>
        </Box>
        <Box className="SettingsLayout">
          <Box className="SettingsSidebar">
            <Box
              className={`SettingsTab ${activeTab === SettingsTab.SCENES ? 'active' : ''}`}
              onClick={() => setActiveTab(SettingsTab.SCENES)}
            >
              {t('modal.app_settings.tabs.scenes.label')}
            </Box>
            <Box
              className={`SettingsTab ${activeTab === SettingsTab.EDITOR ? 'active' : ''}`}
              onClick={() => setActiveTab(SettingsTab.EDITOR)}
            >
              {t('modal.app_settings.tabs.editor.label')}
            </Box>
            <Box
              className={`SettingsTab ${activeTab === SettingsTab.ABOUT ? 'active' : ''}`}
              onClick={() => setActiveTab(SettingsTab.ABOUT)}
            >
              {t('modal.app_settings.tabs.about.label')}
            </Box>
          </Box>
          <Box className="SettingsContent">
            {activeTab === SettingsTab.SCENES && renderScenesTab()}
            {activeTab === SettingsTab.EDITOR && renderEditorTab()}
            {activeTab === SettingsTab.ABOUT && renderAboutTab()}
          </Box>
        </Box>
      </Box>
    </Modal>
  );
}
