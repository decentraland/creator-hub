import React from 'react';
import WorldSettingsIcon from '@mui/icons-material/SpaceDashboard';
import { t } from '/@/modules/store/translation/utils';
import type { WorldSettings } from '/@/lib/worlds';
import { WorldSettingsTab } from '/shared/types/manage';
import type { Props as TabsModalProps } from '../TabsModal';
import { Loader } from '../../Loader';
import { TabsModal } from '../TabsModal';
import './styles.css';

const WORLD_SETTINGS_TABS: Array<{ label: string; value: WorldSettingsTab }> = [
  {
    label: t('modal.world_settings.tabs.details.label'),
    value: WorldSettingsTab.DETAILS,
  },
  {
    label: t('modal.world_settings.tabs.layout.label'),
    value: WorldSettingsTab.LAYOUT,
  },
  {
    label: t('modal.world_settings.tabs.general.label'),
    value: WorldSettingsTab.GENERAL,
  },
  {
    label: t('modal.world_settings.tabs.variables.label'),
    value: WorldSettingsTab.VARIABLES,
  },
  {
    label: t('modal.world_settings.tabs.permissions.label'),
    value: WorldSettingsTab.PERMISSIONS,
  },
];

type Props = Omit<TabsModalProps<WorldSettingsTab>, 'tabs' | 'title' | 'children'> & {
  worldName: string;
  worldSettings: WorldSettings | null;
  isLoading: boolean;
};

const WorldSettingsModal: React.FC<Props> = React.memo(
  ({ worldName, worldSettings, isLoading, activeTab, ...props }) => {
    // TODO: Implement modal content in future PR.

    return (
      <TabsModal
        {...props}
        activeTab={activeTab}
        tabs={WORLD_SETTINGS_TABS}
        title={t('modal.world_settings.title', { worldName: worldName })}
        className="WorldSettingsModal"
        icon={<WorldSettingsIcon />}
      >
        {isLoading ? (
          <Loader size={40} />
        ) : worldSettings ? (
          <div>World Settings</div>
        ) : (
          <div>No world settings found</div>
        )}
      </TabsModal>
    );
  },
);

export { WorldSettingsModal };
