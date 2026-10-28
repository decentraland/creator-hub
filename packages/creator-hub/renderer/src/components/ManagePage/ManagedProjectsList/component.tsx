import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button as DCLButton, Typography } from 'decentraland-ui2';
import { useDispatch, useSelector } from '#store';
import { useAuth } from '/@/hooks/useAuth';
import { WorldPermissionName, WorldRoleType } from '/@/lib/worlds';
import {
  fetchWorldSettings,
  fetchWorldScenes,
  unpublishEntireWorld,
  selectors as managementSelectors,
  fetchParcelsPermission,
} from '/@/modules/store/management';
import { t } from '/@/modules/store/translation/utils';
import { WorldSettingsTab, type ManagedProject } from '/shared/types/manage';
import { Button } from '../../Button';
import { Loader } from '../../Loader';
import { Modal } from '../../Modals';
import { WorldSettingsModal } from '../../Modals/WorldSettingsModal';
import { PublishedProjectCard } from '../PublishedProjectCard';
import './styles.css';

type SettingsModalState = {
  activeTab: WorldSettingsTab;
  isOpen: boolean;
  isOwner?: boolean;
};

type UnpublishConfirmationState = {
  isOpen: boolean;
  worldName: string | null;
  loading?: boolean;
};

type Props = {
  projects: ManagedProject[];
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
};

const ManagedProjectsList: React.FC<Props> = React.memo(props => {
  const { projects, hasMore, isLoading, onLoadMore } = props;
  const { wallet } = useAuth();
  const [settingsModal, setSettingsModal] = useState<SettingsModalState>({
    isOpen: false,
    activeTab: WorldSettingsTab.DETAILS,
    isOwner: false,
  });
  const [unpublishConfirmation, setUnpublishConfirmation] = useState<UnpublishConfirmationState>({
    isOpen: false,
    worldName: null,
    loading: false,
  });
  const worldSettings = useSelector(managementSelectors.getWorldSettings);
  const worldPermissions = useSelector(managementSelectors.getPermissionsState);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleOpenSettingsModal = useCallback(
    (worldName: string, activeTab: WorldSettingsTab, isOwner: boolean) => {
      dispatch(fetchWorldSettings({ worldName }));
      dispatch(fetchWorldScenes({ worldName }));
      if (!isOwner && wallet) {
        dispatch(
          fetchParcelsPermission({
            worldName,
            walletAddress: wallet,
            permissionName: WorldPermissionName.Deployment,
          }),
        );
      }
      setSettingsModal({ isOpen: true, activeTab, isOwner });
    },
    [wallet],
  );

  const handleCloseSettingsModal = useCallback(() => {
    setSettingsModal({ isOpen: false, activeTab: WorldSettingsTab.DETAILS });
  }, []);

  const handleSettingsModalTabClick = useCallback((tab: WorldSettingsTab) => {
    setSettingsModal(prevState => ({ ...prevState, activeTab: tab }));
  }, []);

  const handleShowUnpublishWorldConfirmation = useCallback((worldName: string) => {
    setUnpublishConfirmation({ isOpen: true, worldName });
  }, []);

  const handleCloseUnpublishWorldConfirmation = useCallback(() => {
    setUnpublishConfirmation({ isOpen: false, worldName: null });
  }, []);

  const handleUnpublishWorld = useCallback(async () => {
    if (!unpublishConfirmation.worldName || unpublishConfirmation.loading) return;
    try {
      setUnpublishConfirmation(prevState => ({ ...prevState, loading: true }));
      await dispatch(unpublishEntireWorld({ worldName: unpublishConfirmation.worldName })).unwrap();
      setUnpublishConfirmation({ isOpen: false, worldName: null });
    } finally {
      setUnpublishConfirmation(prevState => ({ ...prevState, loading: false }));
    }
  }, [unpublishConfirmation]);

  const handleViewScenes = useCallback(() => {
    navigate('/scenes');
  }, [navigate]);

  return (
    <div className="ManagedProjectsList">
      {projects.map(project => (
        <PublishedProjectCard
          key={project.id}
          project={project}
          onOpenSettings={activeTab =>
            handleOpenSettingsModal(project.id, activeTab, project.role === WorldRoleType.OWNER)
          }
          onUnpublishWorld={() => handleShowUnpublishWorldConfirmation(project.id)}
          onViewScenes={handleViewScenes}
        />
      ))}
      {hasMore && (
        <Box className="LoadMoreContainer">
          <DCLButton
            disabled={isLoading}
            onClick={onLoadMore}
            color="secondary"
          >
            {t('manage.load_more')}
          </DCLButton>
        </Box>
      )}

      <WorldSettingsModal
        open={settingsModal.isOpen}
        worldName={worldSettings.worldName}
        isOwner={!!settingsModal.isOwner}
        worldScenes={worldSettings.scenes}
        worldSettings={worldSettings.settings}
        userParcelsPermissions={wallet ? worldPermissions.parcels[wallet] : undefined}
        isLoading={worldSettings.status === 'loading' || worldSettings.status === 'idle'}
        activeTab={settingsModal.activeTab}
        onTabClick={handleSettingsModalTabClick}
        onClose={handleCloseSettingsModal}
      />
      <Modal
        open={unpublishConfirmation.isOpen}
        className="UnpublishConfirmationModal"
        actions={
          <>
            <Button
              color="secondary"
              onClick={handleCloseUnpublishWorldConfirmation}
            >
              {t('modal.cancel')}
            </Button>
            <Button
              onClick={handleUnpublishWorld}
              disabled={unpublishConfirmation.loading}
            >
              {unpublishConfirmation.loading ? <Loader size={24} /> : t('modal.confirm')}
            </Button>
          </>
        }
      >
        <Typography variant="h5">
          {t('manage.unpublish_world_confirmation.title', {
            worldName: unpublishConfirmation.worldName,
            b: (chunks: string) => <b>{chunks}</b>,
          })}
        </Typography>
      </Modal>
    </div>
  );
});

export { ManagedProjectsList };
