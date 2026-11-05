import { useNavigate } from 'react-router-dom';

import type { Land } from '/@/lib/land';
import { getLandName } from '/@/modules/store/management/utils';
import { t } from '/@/modules/store/translation/utils';
import type { ManagedProject } from '/shared/types/manage';

import { LayersIcon, LayoutOutlineIcon } from '../../Icons';
import { EmptyState } from '../../ManagePage/EmptyState';
import type { RowMode } from './SceneRow';
import { ScenesView } from './ScenesView';
import { Meta } from './ScenesTab.styled';
import { useLandScenes } from './useLandScenes';

type Props = { land: Land; project: ManagedProject; mode: RowMode };

/** The scenes deployed on a LAND: sort, search, download and unpublish. */
export function ScenesTab({ land, project, mode }: Props) {
  const navigate = useNavigate();
  const { scenes, deployers, unpublishScene } = useLandScenes(land);

  return (
    <ScenesView
      scenes={scenes}
      deployers={deployers}
      mode={mode}
      placeName={getLandName(project)}
      source="land"
      unpublishScene={unpublishScene}
      stats={
        <>
          <Meta>
            <LayersIcon />
            {t('manage.cards.scenes_count', { count: scenes.length })}
          </Meta>
          {project.place?.kind === 'estate' && (
            <Meta>
              <LayoutOutlineIcon />
              {t('manage.cards.land.lands_count', { count: project.place.size })}
            </Meta>
          )}
        </>
      }
      empty={
        <EmptyState
          title={t('land_detail.scenes.empty')}
          action={{
            label: t('manage.cards.no_scene.view_scenes'),
            variant: 'secondary',
            onClick: () => navigate('/scenes'),
          }}
        />
      }
    />
  );
}
