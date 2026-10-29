import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Switch } from 'decentraland-ui2';

import { useSelector } from '#store';
import { config } from '/@/config';
import { toMB } from '/@/modules/file';
import { getCurrentLocale, t } from '/@/modules/store/translation/utils';
import { getWorldDimensions } from '/@/modules/world';
import { WorldAtlas } from '/@/components/WorldAtlas';

import { Button } from '../../Button';
import { LayersIcon, LayoutOutlineIcon } from '../../Icons';
import type { RowMode } from '../../LandDetailPage/ScenesTab/SceneRow';
import { ScenesView } from '../../LandDetailPage/ScenesTab/ScenesView';
import { Meta } from '../../LandDetailPage/ScenesTab/ScenesTab.styled';
import { Loader } from '../../Loader';
import { EmptyState } from '../../ManagePage/EmptyState';
import { InfoTip } from '../../ManagePage/InfoTip';
import { WorldsYourStorageModal } from '../../Modals/WorldsYourStorageModal';
import { MultiScene, StorageLink } from './ScenesTab.styled';
import { useWorldScenes } from './useWorldScenes';
import { usedBytes } from './worldScenes';

type Props = { worldName: string; mode: RowMode };

/** The World's scenes: the owner manages all of them, a deploy collaborator sees the ones on their parcels. */
export function ScenesTab({ worldName, mode }: Props) {
  const navigate = useNavigate();
  const { all, scenes, deployers, ready, unpublishScene } = useWorldScenes(worldName, mode);
  const storageStats = useSelector(state => state.management.storageStats);
  const accountHoldings = useSelector(state => state.management.accountHoldings);
  const [map, setMap] = useState(false);
  const [storageOpen, setStorageOpen] = useState(false);

  if (!ready) return <Loader size={70} />;

  const isOwner = mode === 'manage';
  const { width, height } = getWorldDimensions(all);
  const used = getCurrentLocale().formatNumber(toMB(usedBytes(all)), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <>
      <ScenesView
        scenes={scenes}
        deployers={deployers}
        mode={mode}
        placeName={worldName}
        source={{ contentUrl: config.get('WORLDS_CONTENT_SERVER_URL') }}
        unpublishScene={unpublishScene}
        noticeFor={targets =>
          targets.length === all.length
            ? t('world_detail.scenes.last_scene', { world: worldName })
            : undefined
        }
        stats={
          <>
            <Meta>
              <LayersIcon />
              {t('manage.cards.scenes_count', { count: scenes.length })}
            </Meta>
            {width > 0 && (
              <Meta>
                <LayoutOutlineIcon className="LandsGlyph" />
                {t('world_detail.scenes.parcels_shape', { w: width, h: height })}
              </Meta>
            )}
            {isOwner && (
              <Meta>
                {t('world_detail.scenes.used', { size: `${used} MB` })}
                <StorageLink
                  type="button"
                  onClick={() => setStorageOpen(true)}
                >
                  {t('world_detail.scenes.manage_storage')}
                </StorageLink>
              </Meta>
            )}
          </>
        }
        controls={
          <>
            {isOwner && (
              <MultiScene>
                <Switch
                  checked={all.length > 1}
                  disabled
                  inputProps={{ 'aria-label': t('modal.world_settings.layout.multi_scene_title') }}
                />
                {t('modal.world_settings.layout.multi_scene_title')}
                <InfoTip label={t('world_detail.scenes.multi_scene_info')}>
                  {t('modal.world_settings.layout.multi_scene_description')}
                </InfoTip>
              </MultiScene>
            )}
            <Button
              variant="contained"
              color="secondary"
              size="small"
              startIcon={<LayoutOutlineIcon />}
              aria-pressed={map}
              onClick={() => setMap(open => !open)}
            >
              {t('modal.world_settings.layout.world_map')}
            </Button>
          </>
        }
        alternate={map ? <WorldAtlas worldScenes={all} /> : undefined}
        empty={
          isOwner ? (
            <EmptyState
              title={t('world_detail.scenes.empty')}
              action={{
                label: t('manage.cards.no_scene.view_scenes'),
                variant: 'secondary',
                onClick: () => navigate('/scenes'),
              }}
            />
          ) : (
            <EmptyState title={t('world_detail.scenes.empty_filtered')} />
          )
        }
      />
      {storageStats && (
        <WorldsYourStorageModal
          open={storageOpen}
          stats={storageStats}
          accountHoldings={accountHoldings}
          onClose={() => setStorageOpen(false)}
        />
      )}
    </>
  );
}
