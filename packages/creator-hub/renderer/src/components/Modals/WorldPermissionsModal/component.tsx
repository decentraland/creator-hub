import React, { useState } from 'react';
import LockIcon from '@mui/icons-material/Lock';
import { t } from '/@/modules/store/translation/utils';
import { TabsModal, type Props as TabsModalProps } from '../TabsModal';
import { WorldPermissionsAccessTab } from './tabs/WorldPermissionsAccessTab';
import { WorldPermissionsCollaboratorsTab } from './tabs/WorldPermissionsCollaboratorsTab';
import './styles.css';

enum WorldPermissionsTab {
  ACCESS = 'access',
  COLLABORATORS = 'collaborators',
}

const WORLD_PERMISSIONS_TABS: Array<{ label: string; value: WorldPermissionsTab }> = [
  {
    label: t('modal.world_permissions.tabs.access.label'),
    value: WorldPermissionsTab.ACCESS,
  },
  {
    label: t('modal.world_permissions.tabs.collaborators.label'),
    value: WorldPermissionsTab.COLLABORATORS,
  },
];

type Props = Pick<TabsModalProps<WorldPermissionsTab>, 'open' | 'onClose'> & {
  worldName: string;
};

const WorldPermissionsModal: React.FC<Props> = React.memo(({ worldName, ...props }) => {
  const [activeTab, setActiveTab] = useState<WorldPermissionsTab>(WorldPermissionsTab.ACCESS);

  return (
    <TabsModal
      {...props}
      title={t('modal.world_permissions.title', { worldName: worldName })}
      className="WorldPermissionsModal"
      orientation="horizontal"
      icon={<LockIcon />}
      tabs={WORLD_PERMISSIONS_TABS}
      activeTab={activeTab}
      onTabClick={setActiveTab}
    >
      {activeTab === WorldPermissionsTab.ACCESS && <WorldPermissionsAccessTab />}
      {activeTab === WorldPermissionsTab.COLLABORATORS && <WorldPermissionsCollaboratorsTab />}
    </TabsModal>
  );
});

export { WorldPermissionsModal };
