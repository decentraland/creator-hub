import React from 'react';
import WorldSettingsIcon from '@mui/icons-material/SpaceDashboard';
import { t } from '/@/modules/store/translation/utils';
import type { ManagedProject } from '/shared/types/manage';
import { WorldSettingsTab } from '/shared/types/manage';
import type { Props as TabsModalProps } from '../TabsModal';
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
  project: ManagedProject | null;
};

const WorldSettingsModal: React.FC<Props> = React.memo(({ project, activeTab, ...props }) => {
  /// TODO: Implement modal content, here full modal content should be fetched and rendered based on the project prop. Consume WorldSettings from context

  if (!project) return null;

  return (
    <TabsModal
      {...props}
      activeTab={activeTab}
      tabs={WORLD_SETTINGS_TABS}
      title={t('modal.world_settings.title', { worldName: project.id })}
      className="WorldSettingsModal"
      icon={<WorldSettingsIcon />}
    >
      {project.id}
    </TabsModal>
  );
});

export { WorldSettingsModal };
