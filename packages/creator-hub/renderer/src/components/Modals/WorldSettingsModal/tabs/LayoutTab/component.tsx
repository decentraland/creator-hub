import React, { useCallback, useMemo, useState } from 'react';
import LayersIcon from '@mui/icons-material/Layers';
import MapIcon from '@mui/icons-material/GridOn';
import LocationIcon from '@mui/icons-material/LocationOn';
import ParcelsIcon from '@mui/icons-material/GridViewRounded';
import ArrowBackIcon from '@mui/icons-material/ArrowBackRounded';
import { Box, Typography } from 'decentraland-ui2';
import type { WorldScene, WorldSettings } from '/@/lib/worlds';
import type { Coords } from '/@/lib/land';
import { idToCoords } from '/@/lib/land';
import { t } from '/@/modules/store/translation/utils';
import { formatWorldSize, getWorldDimensions, MAX_COORDINATE } from '/@/modules/world';
import type { Option } from '/@/components/Dropdown';
import { Button } from '/@/components/Button';
import { Row } from '/@/components/Row';
import { WorldAtlas } from '/@/components/WorldAtlas';
import { Image } from '/@/components/Image';
import './styles.css';

enum LayoutView {
  SCENES = 'worldScenes',
  LAYOUT = 'worldLayout',
}

type Props = {
  worldScenes: WorldScene[];
  worldSettings: WorldSettings;
  onChangeSettings: (_settings: Partial<WorldSettings>) => void;
};

const InfoItem = ({ icon, label }: { icon: React.ReactNode; label: string }) => {
  if (!label) return null;
  return (
    <Box className="InfoItem">
      {icon}
      <Typography variant="body2">{label}</Typography>
    </Box>
  );
};

const WorldScenesView: React.FC<{
  worldSettings: WorldSettings;
  worldScenes: WorldScene[];
  onViewLayout: () => void;
}> = React.memo(({ worldSettings, worldScenes, onViewLayout }) => {
  // const [multiSceneEnabled, setMultiSceneEnabled] = useState(true);
  const hasScenes = worldScenes && worldScenes.length > 0;

  const getBaseParcel = useCallback((parcels: string[]): Coords | null => {
    if (!parcels?.length) return null;
    let baseParcel = { x: MAX_COORDINATE, y: MAX_COORDINATE };
    parcels.forEach(parcel => {
      const [x, y] = idToCoords(parcel);
      if (Number(x) < baseParcel.x || Number(y) < baseParcel.y) {
        baseParcel = { x: Number(x), y: Number(y) };
      }
    });
    return [baseParcel.x, baseParcel.y];
  }, []);

  const handleEditScene = useCallback((_scene: WorldScene) => {
    // TODO: Implement edit scene in future PR.
  }, []);

  const handleUnpublishScene = useCallback((_scene: WorldScene) => {
    // TODO: Implement unpublish scene in future PR.
  }, []);

  const _getDropdownOptions = useCallback(
    (scene: WorldScene): Option[] => [
      {
        text: t('modal.world_settings.layout.actions.edit_scene'),
        handler: () => handleEditScene(scene),
      },
      {
        text: t('modal.world_settings.layout.actions.unpublish'),
        handler: () => handleUnpublishScene(scene),
      },
    ],
    [handleEditScene],
  );

  const worldSize = useMemo(() => {
    const { width, height } = getWorldDimensions(worldScenes || []);
    return formatWorldSize({ width, height });
  }, [worldScenes]);

  return (
    <>
      <Box className="MultiSceneToggle">
        <LayersIcon />
        <Box className="ToggleContent">
          <Typography>{t('modal.world_settings.layout.multi_scene_title')}</Typography>
          <Typography
            variant="body2"
            className="ToggleDescription"
          >
            {t('modal.world_settings.layout.multi_scene_description')}
          </Typography>
        </Box>
        {/* TODO: implement functionality on future PR */}
        {/* <Switch
          checked={multiSceneEnabled}
          onChange={event => setMultiSceneEnabled(event.target.checked)}
        /> */}
      </Box>

      {!hasScenes ? (
        <Box className="EmptyWorldState">
          <Typography variant="h6">{t('modal.world_settings.layout.empty_world.title')}</Typography>
          <Typography
            variant="body2"
            className="EmptyDescription"
          >
            {t('modal.world_settings.layout.empty_world.description')}
          </Typography>
        </Box>
      ) : (
        <>
          <Box className="WorldInfo">
            <Box className="WorldThumbnail">
              <Image
                src={worldSettings.thumbnailUrl || ''}
                alt={worldSettings.title || ''}
                fallbackSrc="/assets/images/scene-thumbnail-fallback.png"
              />
            </Box>
            <Box className="WorldInfoContent">
              <Typography className="CurrentWorldLabel">
                {t('modal.world_settings.layout.current_world')}
              </Typography>
              <Typography variant="h6">
                {worldSettings.title || t('modal.world_settings.layout.title_placeholder')}
              </Typography>
              <Row className="WorldMetadata">
                <InfoItem
                  icon={<LayersIcon />}
                  label={t('modal.world_settings.layout.scenes_count', {
                    count: worldScenes.length,
                  })}
                />
                <InfoItem
                  icon={<ParcelsIcon />}
                  label={worldSize}
                />
              </Row>
            </Box>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<MapIcon />}
              className="WorldMapButton"
              onClick={onViewLayout}
            >
              {t('modal.world_settings.layout.world_map')}
            </Button>
          </Box>

          <Box className="ScenesSection">
            <Typography variant="h6">{t('modal.world_settings.layout.scenes_title')}</Typography>
            {worldScenes.map((scene, index) => (
              <Box
                key={scene.entityId}
                className="SceneItem"
              >
                <Box className="SceneThumbnail">
                  <Image
                    src={scene.thumbnailUrl || ''}
                    alt={`Scene ${index + 1}`}
                    fallbackSrc="/assets/images/scene-thumbnail-fallback.png"
                  />
                </Box>
                <Box className="SceneInfo">
                  <Typography className="SceneTitle">
                    {scene.entity?.metadata?.display?.title ||
                      t('modal.world_settings.layout.scene_title_placeholder')}
                  </Typography>
                  <Box className="SceneMetadata">
                    <InfoItem
                      icon={<ParcelsIcon />}
                      label={t('modal.world_settings.layout.parcels_count', {
                        count: scene.parcels?.length || 0,
                      })}
                    />
                    <InfoItem
                      icon={<LocationIcon />}
                      label={getBaseParcel(scene.parcels || [])?.join(', ') || ''}
                    />
                  </Box>
                </Box>
                {/* TODO: implement functionality on future PR */}
                {/* <Dropdown options={getDropdownOptions(scene)} /> */}
              </Box>
            ))}
          </Box>
        </>
      )}
    </>
  );
});

const WorldLayoutView: React.FC<{ worldScenes: WorldScene[]; onGoBack: () => void }> = React.memo(
  ({ worldScenes, onGoBack }) => {
    return (
      <>
        <Box className="WorldLayoutTitle">
          <ArrowBackIcon
            role="button"
            onClick={onGoBack}
            className="WorldLayoutBackButton"
          />
          <Typography variant="h6">
            {t('modal.world_settings.layout.world_layout.title')}
          </Typography>
        </Box>
        <WorldAtlas worldScenes={worldScenes} />
      </>
    );
  },
);

const LayoutTab: React.FC<Props> = React.memo(({ worldSettings, worldScenes }) => {
  const [activeView, setActiveView] = useState<LayoutView>(LayoutView.SCENES);

  return (
    <Box className="LayoutTab">
      {activeView === LayoutView.SCENES && (
        <WorldScenesView
          worldSettings={worldSettings}
          worldScenes={worldScenes}
          onViewLayout={() => setActiveView(LayoutView.LAYOUT)}
        />
      )}
      {activeView === LayoutView.LAYOUT && (
        <WorldLayoutView
          worldScenes={worldScenes}
          onGoBack={() => setActiveView(LayoutView.SCENES)}
        />
      )}
    </Box>
  );
});

export { LayoutTab };
