import { useCallback, useEffect, useState } from 'react';
import SettingsIcon from '@mui/icons-material/Settings';
import equal from 'fast-deep-equal';
import {
  loadEditors,
  setDefaultEditor,
  addEditor,
  removeEditor,
  getEditors,
} from '/@/modules/store/defaultEditor';

import { debounce } from '/shared/utils';
import { GITHUB_RELEASES_URL } from '/shared/urls';

import { t } from '/@/modules/store/translation/utils';
import { useSettings } from '/@/hooks/useSettings';
import { useWorkspace } from '/@/hooks/useWorkspace';
import { useEditor } from '/@/hooks/useEditor';
import { useDispatch, useSelector } from '#store';
import { settings as settingsPreload, misc } from '#preload';
import { TabsModal } from '../TabsModal';
import { ScenesTab, EditorTab, AboutTab } from './Tabs';

import './styles.css';

enum SettingsTab {
  SCENES = 'scenes',
  EDITOR = 'editor',
  ABOUT = 'about',
}

const SETTINGS_TABS: Array<{ label: string; value: SettingsTab }> = [
  {
    label: t('modal.app_settings.tabs.scenes.label'),
    value: SettingsTab.SCENES,
  },
  {
    label: t('modal.app_settings.tabs.editor.label'),
    value: SettingsTab.EDITOR,
  },
  {
    label: t('modal.app_settings.tabs.about.label'),
    value: SettingsTab.ABOUT,
  },
];

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

  const handleUpdateSettings = useCallback(
    (newSettings: typeof settings) => {
      setSettings(newSettings);
      updateAppSettings(newSettings);
    },
    [updateAppSettings],
  );

  const handleOpenFolder = useCallback(async () => {
    const folder = await settingsPreload.selectSceneFolder();
    if (folder) {
      const newSettings = { ...settings, scenesPath: folder };
      handleUpdateSettings(newSettings);
      validateScenesPathField(newSettings.scenesPath);
    }
  }, [settings, handleUpdateSettings, validateScenesPathField]);

  const handleResetScenesFolder = useCallback(async () => {
    const defaultPath = await settingsPreload.getDefaultScenesPath();
    const newSettings = { ...settings, scenesPath: defaultPath };
    handleUpdateSettings(newSettings);
    validateScenesPathField(defaultPath);
  }, [settings, handleUpdateSettings, validateScenesPathField]);

  const handleViewChangelog = useCallback(() => {
    if (!version) return;
    misc.openExternal(`${GITHUB_RELEASES_URL}/${version}`);
  }, [version]);

  const handleSetDefaultEditor = useCallback(
    (path: string) => {
      dispatch(setDefaultEditor(path));
    },
    [dispatch],
  );

  const handleAddEditor = useCallback(
    (path: string) => {
      dispatch(addEditor(path));
    },
    [dispatch],
  );

  const handleRemoveEditor = useCallback(
    (path: string) => {
      dispatch(removeEditor(path));
    },
    [dispatch],
  );

  const handleSelectEditorPath = useCallback(async (): Promise<string | null> => {
    const [editorPath] = await settingsPreload.selectEditorPath();
    return editorPath || null;
  }, []);

  const renderTabContent = () => {
    switch (activeTab) {
      case SettingsTab.SCENES:
        return (
          <ScenesTab
            settings={settings}
            updateSettings={handleUpdateSettings}
            error={error}
            isCustomScenesPath={isCustomScenesPath}
            onOpenFolder={handleOpenFolder}
            onResetScenesFolder={handleResetScenesFolder}
            onValidateScenesPath={validateScenesPathField}
          />
        );
      case SettingsTab.EDITOR:
        return (
          <EditorTab
            settings={settings}
            updateSettings={handleUpdateSettings}
            editors={editors || []}
            loading={loading}
            onSetDefaultEditor={handleSetDefaultEditor}
            onAddEditor={handleAddEditor}
            onRemoveEditor={handleRemoveEditor}
            onSelectEditorPath={handleSelectEditorPath}
          />
        );
      case SettingsTab.ABOUT:
        return (
          <AboutTab
            version={version}
            onViewChangelog={handleViewChangelog}
          />
        );
      default:
        return null;
    }
  };

  return (
    <TabsModal
      open={open}
      className="AppSettingsModal"
      icon={<SettingsIcon />}
      title={t('modal.app_settings.title')}
      tabs={SETTINGS_TABS}
      activeTab={activeTab}
      onTabClick={setActiveTab}
      onClose={onClose}
    >
      {renderTabContent()}
    </TabsModal>
  );
}
