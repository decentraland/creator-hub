import type { AppSettings } from '/shared/types/settings';
import type { EditorConfig } from '/shared/types/config';

/**
 * Base props shared by all tab components that need settings access
 */
export interface BaseTabProps {
  settings: AppSettings;
  updateSettings: (settings: AppSettings) => void;
}

export interface ScenesTabProps extends BaseTabProps {
  error: string | null;
  isCustomScenesPath: boolean;
  onOpenFolder: () => void;
  onResetScenesFolder: () => void;
  onValidateScenesPath: (path: string) => void;
}

export interface EditorTabProps extends BaseTabProps {
  editors: EditorConfig[];
  loading: boolean;
  onSetDefaultEditor: (path: string) => void;
  onAddEditor: (path: string) => void;
  onRemoveEditor: (path: string) => void;
  onSelectEditorPath: () => Promise<string | null>;
}

export interface AboutTabProps {
  version: string | null;
  onViewChangelog: () => void;
}
