import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SceneParcels } from '@dcl/schemas';
import { Atlas } from 'decentraland-ui2/dist/components/Atlas/Atlas';
import { Box, Button, styled, Typography } from 'decentraland-ui2';

import { useSelector } from '#store';

import { config } from '/@/config';
import { t } from '/@/modules/store/translation/utils';
import { selectors as landSelectors } from '/@/modules/store/land';
import { Lands } from '/@/lib/land';
import { useEditor } from '/@/hooks/useEditor';
import { useWorkspace } from '/@/hooks/useWorkspace';
import { COLORS, type Props, type Coordinate } from '../../types';
import { breaksLandPlaceContinuity, calculateParcels, parseCoords } from '../../utils';
import { PublishModal } from '../../PublishModal';
import { PlaceContinuityWarning } from '../../PlaceContinuityWarning';

const CONTENT_SERVER = config.get('PEER_URL');

const PublishToLandModal = styled(PublishModal)({
  '& > .MuiPaper-root > .MuiBox-root:last-child': {
    padding: 0,
  },
});

export function PublishToLand(props: Props) {
  const { project, publishScene } = useEditor();
  const { updateProject, updateSceneJson } = useWorkspace();
  const tiles = useSelector(state => state.land.tiles);
  const landTiles = useSelector(state => landSelectors.getLandTiles(state.land));
  const [hover, setHover] = useState<Coordinate>({ x: 0, y: 0 });
  const [placement, setPlacement] = useState<Coordinate | null>(null);
  const [initialPlacement, setInitialPlacement] = useState<Coordinate | null>(null);
  const [didAutoPlace, setDidAutoPlace] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  /** Scene waiting for the user to confirm a deployment that breaks its Place continuity. */
  const [pendingScene, setPendingScene] = useState<SceneParcels | null>(null);

  if (!project) return null;

  // Memoize the project parcels centered around the hover position
  const projectParcels = useMemo(() => calculateParcels(project, hover), [project, hover]);

  const placedParcels = useMemo(
    () => (placement ? calculateParcels(project, placement) : []),
    [project, placement],
  );

  const publish = useCallback(
    async (sceneUpdates: SceneParcels) => {
      await updateSceneJson(project.path, { scene: sceneUpdates, worldConfiguration: undefined });
      updateProject({
        ...project,
        scene: sceneUpdates,
        worldConfiguration: undefined, // Cannot deploy to a LAND with a world configuration
        updatedAt: Date.now(),
      });
      publishScene({ target: CONTENT_SERVER });
      props.onStep('deploy');
    },
    [project, props.onStep],
  );

  const handleNext = useCallback(async () => {
    if (!placement) return;
    const sceneUpdates: SceneParcels = {
      base: `${placement.x},${placement.y}`,
      parcels: calculateParcels(project, placement).map(({ x, y }) => `${x},${y}`),
    };

    // A redeployment keeps the scene's Place unless it changes both the base parcel and the set
    // of occupied parcels. Look up what is currently deployed where the scene is being placed.
    setIsChecking(true);
    let continuityBroken = false;
    try {
      const deployed = await new Lands().fetchLandPublishedScenes(
        calculateParcels(project, placement).map(({ x, y }): [number, number] => [x, y]),
      );
      continuityBroken = breaksLandPlaceContinuity(
        deployed.map(scene => ({
          base: scene.metadata?.scene?.base ?? '',
          parcels: scene.metadata?.scene?.parcels ?? scene.pointers ?? [],
        })),
        sceneUpdates,
      );
    } catch (error) {
      // Not being able to tell must not block publishing.
      console.error('Could not check the Place continuity of the deployment', error);
    } finally {
      setIsChecking(false);
    }

    if (continuityBroken) {
      setPendingScene(sceneUpdates);
    } else {
      await publish(sceneUpdates);
    }
  }, [placement, project, publish]);

  const handleConfirmWarning = useCallback(async () => {
    if (pendingScene) await publish(pendingScene);
  }, [pendingScene, publish]);

  const handleCancelWarning = useCallback(() => {
    setPendingScene(null);
  }, []);

  const handleHover = useCallback((x: number, y: number) => {
    setHover({ x, y });
  }, []);

  const isHighlighted = useCallback(
    (x: number, y: number) =>
      !placement && projectParcels.some(parcel => parcel.x === x && parcel.y === y),
    [placement, projectParcels],
  );

  const isPlaced = useCallback(
    (x: number, y: number) => placedParcels.some(parcel => parcel.x === x && parcel.y === y),
    [placedParcels],
  );

  const isValid = useMemo(() => {
    return hover && projectParcels.every(({ x, y }) => !!landTiles[`${x},${y}`]);
  }, [landTiles, hover, projectParcels]);

  const strokeLayer = useCallback(
    (x: number, y: number) => {
      const placed = isPlaced(x, y);
      if (isHighlighted(x, y) || placed) {
        return {
          color: isValid || placed ? COLORS.selectedStroke : COLORS.indicatorStroke,
          scale: 1.35,
        };
      }
      return null;
    },
    [isHighlighted, isValid, isPlaced],
  );

  const highlightLayer = useCallback(
    (x: number, y: number) => {
      const placed = isPlaced(x, y);
      if (isHighlighted(x, y) || placed) {
        return { color: isValid || placed ? COLORS.selected : COLORS.indicator, scale: 1.15 };
      }
      return null;
    },
    [isHighlighted, isValid, isPlaced],
  );

  const ownedLayer = useCallback(
    (x: number, y: number) => {
      const key = `${x},${y}`;
      return landTiles[key] && landTiles[key].land.owner === tiles[key]?.owner
        ? { color: COLORS.freeParcel }
        : null;
    },
    [tiles, landTiles],
  );

  const handlePlacement = useCallback(
    (x: number, y: number) => {
      if (!isValid) return;
      setPlacement({ x, y });
    },
    [project, isValid],
  );

  const handleClearPlacement = useCallback(() => {
    setPlacement(null);
  }, []);

  // set initial placement
  useEffect(() => {
    if (!initialPlacement) {
      const { base, parcels } = project.scene;
      // use the base parcel if it's a valid coord
      if (base in landTiles && parcels.every(parcel => parcel in landTiles)) {
        const [x, y] = parseCoords(base);
        setInitialPlacement({ x, y });
      } else {
        // if the base parcel in the scene.json is not valid (ie. it is 0,0) then select the first coord of the available tiles as the initial placement
        const available = Object.keys(landTiles);
        if (available.length > 0) {
          const [x, y] = parseCoords(available[0]);
          setInitialPlacement({ x, y });
        }
      }
    }
  }, [initialPlacement, setInitialPlacement, project, landTiles]);

  // use initial placement if possible
  useEffect(() => {
    if (didAutoPlace) return;
    if (!placement && initialPlacement) {
      const initialPlacementParcels = calculateParcels(project, initialPlacement);
      if (initialPlacementParcels.every(({ x, y }) => !!landTiles[`${x},${y}`])) {
        setPlacement(initialPlacement);
        setDidAutoPlace(true);
      }
    }
  }, [placement, setPlacement, initialPlacement, didAutoPlace, setDidAutoPlace, landTiles]);

  if (pendingScene) {
    return (
      <PublishModal
        title={t('modal.publish_project.land.action')}
        size="large"
        {...props}
        onBack={handleCancelWarning}
      >
        <Box
          display="flex"
          flexDirection="column"
          gap={2}
          padding={2}
        >
          <PlaceContinuityWarning kind="land" />
          <Box
            display="flex"
            gap={1}
          >
            <Button
              color="secondary"
              size="large"
              fullWidth
              onClick={handleCancelWarning}
            >
              {t('modal.publish_project.place_continuity.cancel')}
            </Button>
            <Button
              size="large"
              fullWidth
              onClick={handleConfirmWarning}
            >
              {t('modal.publish_project.place_continuity.confirm')}
            </Button>
          </Box>
        </Box>
      </PublishModal>
    );
  }

  return (
    <PublishToLandModal
      title={t('modal.publish_project.land.action')}
      size="large"
      {...props}
    >
      <Box>
        <Box
          height={480}
          style={{ backgroundColor: 'black' }}
        >
          {/* @ts-expect-error TODO: Update properties in UI2, making the not required `optional` */}
          <Atlas
            tiles={tiles}
            layers={[ownedLayer, strokeLayer, highlightLayer]}
            onHover={handleHover}
            onClick={handlePlacement}
            withZoomControls
            x={initialPlacement?.x as number}
            y={initialPlacement?.y as number}
          />
        </Box>
        <Box
          padding={2}
          paddingBottom={1}
          display="flex"
          justifyContent="space-between"
          alignItems="center"
        >
          <Box
            flex={1}
            display="flex"
            padding={1}
            mr={2}
            sx={{ border: '1px solid grey', borderRadius: '8px' }}
            justifyContent="center"
            alignItems="baseline"
            height={45}
          >
            <Typography variant="body1">
              {placement
                ? t('modal.publish_project.land.select_parcel.place_scene', {
                    coords: `${placement.x},${placement.y}`,
                  })
                : t('modal.publish_project.land.select_parcel.select_parcel')}
            </Typography>
            {placement && (
              <Button
                variant="text"
                size="small"
                onClick={handleClearPlacement}
                sx={{ marginLeft: 1, padding: 0 }}
              >
                {t('modal.publish_project.land.select_parcel.actions.reset')}
              </Button>
            )}
          </Box>
          <Button
            variant="contained"
            color="primary"
            size="large"
            onClick={handleNext}
            disabled={!placement || isChecking}
            sx={{ height: '45px' }}
          >
            {isChecking
              ? t('modal.publish_project.place_continuity.checking')
              : t('modal.publish_project.land.select_parcel.actions.publish')}
          </Button>
        </Box>
      </Box>
    </PublishToLandModal>
  );
}
