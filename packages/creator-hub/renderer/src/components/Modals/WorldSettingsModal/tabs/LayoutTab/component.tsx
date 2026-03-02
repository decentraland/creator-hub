import React, { useCallback, useMemo, useState } from 'react';
import LayersIcon from '@mui/icons-material/Layers';
import MapIcon from '@mui/icons-material/GridOn';
import LocationIcon from '@mui/icons-material/LocationOn';
import ParcelsIcon from '@mui/icons-material/GridViewRounded';
import ArrowBackIcon from '@mui/icons-material/ArrowBackRounded';
import WarningIcon from '@mui/icons-material/WarningAmber';
import { Box, Typography } from 'decentraland-ui2';
import FallbackThumbnail from '/assets/images/scene-thumbnail-fallback.png';
import { useDispatch } from '#store';
import type { WorldScene, WorldSettings } from '/@/lib/worlds';
import { type Coords, idToCoords } from '/@/lib/land';
import { t } from '/@/modules/store/translation/utils';
import { actions as managementActions } from '/@/modules/store/management';
import { formatWorldSize, getWorldDimensions, MAX_COORDINATE } from '/@/modules/world';
import { Dropdown, type Option } from '/@/components/Dropdown';
import { Button } from '/@/components/Button';
import { Row } from '/@/components/Row';
import { WorldAtlas } from '/@/components/WorldAtlas';
import { Image } from '/@/components/Image';
import { Loader } from '/@/components/Loader';
import './styles.css';

enum LayoutView {
  SCENES = 'worldScenes',
  LAYOUT = 'worldLayout',
  UNPUBLISH_CONFIRMATION = 'unpublishConfirmation',
}

type Props = {
  worldName: string;
  worldScenes: WorldScene[];
  worldSettings: WorldSettings;
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
  onUnpublish: (scene: WorldScene) => void;
}> = React.memo(({ worldSettings, worldScenes, onViewLayout, onUnpublish }) => {
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

  const getDropdownOptions = useCallback(
    (scene: WorldScene): Option[] => [
      {
        text: t('modal.world_settings.layout.actions.unpublish'),
        handler: () => onUnpublish(scene),
      },
    ],
    [onUnpublish],
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
                src={worldSettings.thumbnail || ''}
                alt={worldSettings.title || ''}
                fallbackSrc={FallbackThumbnail}
              />
            </Box>
            <Box className="WorldInfoContent">
              <Typography className="CurrentWorldLabel">
                {t('modal.world_settings.layout.current_world')}
              </Typography>
              <Typography
                variant="h6"
                className="WorldTitle"
              >
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
            {worldScenes.map(scene => (
              <Box
                key={scene.entityId}
                className="SceneItem"
              >
                <Box className="SceneThumbnail">
                  <Image
                    src={scene.thumbnailUrl || ''}
                    alt="Scene Thumbnail"
                    fallbackSrc={FallbackThumbnail}
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
                <Dropdown options={getDropdownOptions(scene)} />
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

const UnpublishConfirmationView: React.FC<{
  sceneTitle: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}> = React.memo(({ sceneTitle, onCancel, onConfirm }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    setIsLoading(true);
    await onConfirm();
    setIsLoading(false);
  };

  return (
    <Box className="UnpublishConfirmationView">
      <Typography variant="h5">
        {t('modal.world_settings.layout.unpublish_confirmation.title', {
          name: sceneTitle,
          b: (chunks: React.ReactNode) => <b>{chunks}</b>,
        })}
      </Typography>
      <Box className="WarningContainer">
        <WarningIcon />
        <Typography variant="body2">
          {t('modal.world_settings.layout.unpublish_confirmation.warning_title')}
        </Typography>
      </Box>
      <Box className="UnpublishActions">
        <Button
          color="secondary"
          fullWidth
          onClick={onCancel}
        >
          {t('modal.world_settings.layout.actions.cancel')}
        </Button>
        <Button
          fullWidth
          onClick={handleConfirm}
        >
          {isLoading ? <Loader size={24} /> : t('modal.world_settings.layout.actions.confirm')}
        </Button>
      </Box>
    </Box>
  );
});

const LayoutTab: React.FC<Props> = React.memo(({ worldName, worldSettings, worldScenes }) => {
  const [activeView, setActiveView] = useState<LayoutView>(LayoutView.SCENES);
  const [selectedScene, setSelectedScene] = useState<WorldScene | null>(null);
  const dispatch = useDispatch();

  const handleOpenConfirmation = useCallback((scene: WorldScene) => {
    setSelectedScene(scene);
    setActiveView(LayoutView.UNPUBLISH_CONFIRMATION);
  }, []);

  const handleCloseConfirmation = useCallback(() => {
    setSelectedScene(null);
    setActiveView(LayoutView.SCENES);
  }, []);

  const handleUnpublishScene = useCallback(async () => {
    if (!selectedScene || !selectedScene.parcels?.length) return;
    try {
      await dispatch(
        managementActions.unpublishWorldScene({
          worldName,
          sceneCoord: selectedScene.parcels[0], // we can use any of the scene parcels to unpublish it
        }),
      ).unwrap();
      handleCloseConfirmation();
    } catch {
      // Error is handled in the action.
    }
  }, [selectedScene]);

  return (
    <Box className="LayoutTab">
      {activeView === LayoutView.SCENES && (
        <WorldScenesView
          worldSettings={worldSettings}
          worldScenes={worldScenes}
          onViewLayout={() => setActiveView(LayoutView.LAYOUT)}
          onUnpublish={handleOpenConfirmation}
        />
      )}
      {activeView === LayoutView.LAYOUT && (
        <WorldLayoutView
          worldScenes={worldScenes}
          onGoBack={() => setActiveView(LayoutView.SCENES)}
        />
      )}
      {activeView === LayoutView.UNPUBLISH_CONFIRMATION && (
        <UnpublishConfirmationView
          sceneTitle={
            selectedScene?.entity?.metadata?.display?.title ||
            t('modal.world_settings.layout.scene_title_placeholder')
          }
          onCancel={handleCloseConfirmation}
          onConfirm={handleUnpublishScene}
        />
      )}
    </Box>
  );
});

export { LayoutTab };
