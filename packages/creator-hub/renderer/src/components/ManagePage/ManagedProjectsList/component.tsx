import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AppState } from '#store';
import { useDispatch, useSelector } from '#store';
import { fetchWorldSettings } from '/@/modules/store/management';
import { WorldSettingsTab, type ManagedProject } from '/shared/types/manage';
import { WorldSettingsModal } from '../../Modals/WorldSettingsModal';
import { PublishedProjectCard } from '../PublishedProjectCard';
import './styles.css';

type SettingsModalState = {
  activeTab: WorldSettingsTab;
  isOpen: boolean;
};

type Props = {
  projects: ManagedProject[];
};

const ManagedProjectsList: React.FC<Props> = React.memo(({ projects }) => {
  const [settingsModal, setSettingsModal] = useState<SettingsModalState>({
    isOpen: false,
    activeTab: WorldSettingsTab.DETAILS,
  });
  const dispatch = useDispatch();
  const worldSettings = useSelector((state: AppState) => state.management.worldSettings);
  const navigate = useNavigate();

  const handleOpenSettingsModal = useCallback(
    (project: ManagedProject, activeTab: WorldSettingsTab = WorldSettingsTab.DETAILS) => {
      dispatch(fetchWorldSettings({ worldName: project.id }));
      setSettingsModal({ isOpen: true, activeTab });
    },
    [],
  );

  const handleCloseSettingsModal = useCallback(() => {
    setSettingsModal({ isOpen: false, activeTab: WorldSettingsTab.DETAILS });
  }, []);

  const handleModalTabClick = useCallback((tab: WorldSettingsTab) => {
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
          onOpenSettings={activeTab => handleOpenSettingsModal(project, activeTab)}
          onViewScenes={handleViewScenes}
        />
      ))}

      <WorldSettingsModal
        open={settingsModal.isOpen}
        worldName={worldSettings.worldName}
        worldSettings={worldSettings.settings}
        isLoading={worldSettings.status === 'loading' || worldSettings.status === 'idle'}
        activeTab={settingsModal.activeTab}
        onTabClick={handleModalTabClick}
        onClose={handleCloseSettingsModal}
      />
    </div>
  );
});

export { ManagedProjectsList };
