import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button as DCLButton } from 'decentraland-ui2';
import { useSnackbar } from '/@/hooks/useSnackbar';
import { t } from '/@/modules/store/translation/utils';
import { type ManagedProject } from '/shared/types/manage';
import { Grid } from '../Grid.styled';
import { PlaceCard } from '../PlaceCard';
import { UnpublishWorldModal } from './UnpublishWorldModal';
import { toWorldCard } from './worldCard';
import { getWorldMenuOptions } from './worldMenu';
import './styles.css';

type Props = {
  projects: ManagedProject[];
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
};

const ManagedProjectsList: React.FC<Props> = React.memo(props => {
  const { projects, hasMore, isLoading, onLoadMore } = props;
  const { pushGeneric } = useSnackbar();
  const [unpublishing, setUnpublishing] = useState<string | null>(null);
  const navigate = useNavigate();

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
              onUnpublishWorld: () => setUnpublishing(project.id),
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

      <UnpublishWorldModal
        worldName={unpublishing}
        onClose={() => setUnpublishing(null)}
      />
    </div>
  );
});

export { ManagedProjectsList };
