import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AppState } from '#store';
import { useDispatch, useSelector } from '#store';
import { fetchWorldScenes, fetchWorldSettings } from '/@/modules/store/management';
import { WorldSettingsTab, type ManagedProject } from '/shared/types/manage';
import { WorldSettingsModal } from '../../Modals/WorldSettingsModal';
import { WorldPermissionsModal } from '../../Modals/WorldPermissionsModal';
import { PublishedProjectCard } from '../PublishedProjectCard';
import './styles.css';

type SettingsModalState = {
  activeTab: WorldSettingsTab;
  isOpen: boolean;
};

type PermissionsModalState = {
  isOpen: boolean;
  worldName: string;
};

type Props = {
  projects: ManagedProject[];
};

const ManagedProjectsList: React.FC<Props> = React.memo(({ projects }) => {
  const [settingsModal, setSettingsModal] = useState<SettingsModalState>({
    isOpen: false,
    activeTab: WorldSettingsTab.DETAILS,
  });
  const [permissionsModal, setPermissionsModal] = useState<PermissionsModalState>({
    isOpen: false,
    worldName: '',
  });
  const dispatch = useDispatch();
  const worldSettings = useSelector((state: AppState) => state.management.worldSettings);
  const navigate = useNavigate();

  const handleOpenPermissionsModal = useCallback((worldName: string) => {
    setPermissionsModal({ isOpen: true, worldName });
  }, []);

  const handleClosePermissionsModal = useCallback(() => {
    setPermissionsModal({ isOpen: false, worldName: '' });
  }, []);

  const handleOpenSettingsModal = useCallback(
    (worldName: string, activeTab: WorldSettingsTab = WorldSettingsTab.DETAILS) => {
      dispatch(fetchWorldSettings({ worldName }));
      dispatch(fetchWorldScenes({ worldName }));
      setSettingsModal({ isOpen: true, activeTab });
    },
    [],
  );

  const handleCloseSettingsModal = useCallback(() => {
    setSettingsModal({ isOpen: false, activeTab: WorldSettingsTab.DETAILS });
  }, []);

  const handleSettingsModalTabClick = useCallback((tab: WorldSettingsTab) => {
    setSettingsModal(prevState => ({ ...prevState, activeTab: tab }));
  }, []);

  const handleViewScenes = useCallback(() => {
    navigate('/scenes');
  }, [navigate]);

  return (
    <div className="ManagedProjectsList">
      {projects.map(project => (
        <PublishedProjectCard
          key={project.id}
          project={project}
          onOpenSettings={activeTab => handleOpenSettingsModal(project.id, activeTab)}
          onOpenPermissions={() => handleOpenPermissionsModal(project.id)}
          onViewScenes={handleViewScenes}
        />
      ))}

      <WorldSettingsModal
        open={settingsModal.isOpen}
        worldName={worldSettings.worldName}
        worldScenes={worldSettings.scenes}
        worldSettings={worldSettings.settings}
        isLoading={worldSettings.status === 'loading' || worldSettings.status === 'idle'}
        activeTab={settingsModal.activeTab}
        onTabClick={handleSettingsModalTabClick}
        onClose={handleCloseSettingsModal}
      />
      <WorldPermissionsModal
        open={permissionsModal.isOpen}
        worldName={permissionsModal.worldName}
        onClose={handleClosePermissionsModal}
      />
    </div>
  );
});

export { ManagedProjectsList };
