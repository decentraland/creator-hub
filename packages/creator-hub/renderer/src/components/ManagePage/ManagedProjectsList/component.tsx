import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button as DCLButton, Typography } from 'decentraland-ui2';
import { useDispatch } from '#store';
import { useSnackbar } from '/@/hooks/useSnackbar';
import { unpublishEntireWorld } from '/@/modules/store/management';
import { t } from '/@/modules/store/translation/utils';
import { type ManagedProject } from '/shared/types/manage';
import { Button } from '../../Button';
import { Loader } from '../../Loader';
import { Modal } from '../../Modals';
import { Grid } from '../Grid.styled';
import { PlaceCard } from '../PlaceCard';
import { toWorldCard } from './worldCard';
import { getWorldMenuOptions } from './worldMenu';
import './styles.css';

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
  const { pushGeneric } = useSnackbar();
  const [unpublishConfirmation, setUnpublishConfirmation] = useState<UnpublishConfirmationState>({
    isOpen: false,
    worldName: null,
    loading: false,
  });
  const dispatch = useDispatch();
  const navigate = useNavigate();

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
      <Grid>
        {projects.map(project => (
          <PlaceCard
            key={project.id}
            {...toWorldCard(project)}
            menuOptions={getWorldMenuOptions(project, {
              onUnpublishWorld: () => handleShowUnpublishWorldConfirmation(project.id),
              onUrlCopied: () => pushGeneric('success', t('snackbar.generic.url_copied')),
            })}
            onViewScenes={handleViewScenes}
          />
        ))}
      </Grid>
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
