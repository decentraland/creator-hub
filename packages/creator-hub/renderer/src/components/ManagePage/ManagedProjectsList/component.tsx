import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WorldSettingsTab, type ManagedProject } from '/shared/types/manage';
import { PublishedProjectCard } from '../PublishedProjectCard';
import { WorldSettingsModal } from '../../Modals/WorldSettingsModal';
import './styles.css';

type SettingsModalState = {
  activeTab: WorldSettingsTab;
  isOpen: boolean;
  project?: ManagedProject;
};

type Props = {
  projects: ManagedProject[];
};

const ManagedProjectsList: React.FC<Props> = React.memo(({ projects }) => {
  const [settingsModal, setSettingsModal] = useState<SettingsModalState>({
    isOpen: false,
    activeTab: WorldSettingsTab.DETAILS,
  });
  const navigate = useNavigate();

  const handleOpenSettingsModal = useCallback(
    (project: ManagedProject, activeTab: WorldSettingsTab = WorldSettingsTab.DETAILS) => {
      setSettingsModal({ isOpen: true, project, activeTab });
    },
    [],
  );

  const handleCloseSettingsModal = useCallback(() => {
    setSettingsModal({ isOpen: false, activeTab: WorldSettingsTab.DETAILS });
  }, []);

  const handleModalTabClick = useCallback((tab: WorldSettingsTab) => {
    setSettingsModal(prevState => ({
      ...prevState,
      activeTab: tab,
    }));
  }, []);

  const handleViewScenes = useCallback(() => {
    /// TODO: check if this is the expected behavior
    navigate('/scenes');
  }, [navigate]);

  return (
    <div className="ManagedProjectsList">
      {projects.map(project => (
        <PublishedProjectCard
          key={project.id}
          name={project.id}
          type={project.type}
          role={project.role}
          /// TODO: code this condition reliably
          publishMetadata={
            project.title
              ? {
                  title: project.title,
                  thumbnail: project.thumbnail,
                  totalParcels: project.totalParcels,
                  totalScenes: project.totalScenes,
                }
              : undefined
          }
          onOpenSettings={activeTab => handleOpenSettingsModal(project, activeTab)}
          onViewScenes={handleViewScenes}
        />
      ))}

      <WorldSettingsModal
        open={settingsModal.isOpen}
        project={settingsModal.isOpen ? (settingsModal.project as ManagedProject) : null}
        activeTab={settingsModal.activeTab}
        onTabClick={handleModalTabClick}
        onClose={handleCloseSettingsModal}
      />
    </div>
  );
});

export { ManagedProjectsList };
