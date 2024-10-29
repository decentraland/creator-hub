import { useCallback, useMemo, useState } from 'react';
import { Box, Button, Typography } from 'decentraland-ui2';
import { Atlas } from 'decentraland-ui2/dist/components/Atlas/Atlas';
import { DEPLOY_URLS } from '/shared/types/deploy';
import type { Project } from '/shared/types/projects';
import { useSelector } from '#store';
import { t } from '/@/modules/store/translation/utils';
import { selectors as landSelectors } from '/@/modules/store/land';
import { useEditor } from '/@/hooks/useEditor';
import { COLORS, type Coordinate } from './types';

function calculateParcels(project: Project, point: Coordinate): Coordinate[] {
  const [baseX, baseY] = project.scene.base.split(',').map(coord => parseInt(coord, 10));
  return project.scene.parcels.map(parcel => {
    const [x, y] = parcel.split(',').map(coord => parseInt(coord, 10));
    return { x: x - baseX + point.x, y: y - baseY + point.y };
  });
}

export function PublishToLand({ onClose }: { onClose: () => void }) {
  const { project, publishScene, updateProject } = useEditor();
  const tiles = useSelector(state => state.land.tiles);
  const landTiles = useSelector(state => landSelectors.getLandTiles(state.land));
  const [hover, setHover] = useState<Coordinate>({ x: 0, y: 0 });
  const [placement, setPlacement] = useState<Coordinate | null>(null);

  if (!project) return null;

  // Memoize the project parcels centered around the hover position
  const projectParcels = useMemo(() => calculateParcels(project, hover), [project, hover]);

  const handleClickPublish = useCallback(() => {
    publishScene({ target: import.meta.env.VITE_CATALYST_SERVER || DEPLOY_URLS.CATALYST_SERVER });
    onClose();
  }, [publishScene, onClose]);

  const handleHover = useCallback((x: number, y: number) => {
    setHover({ x, y });
  }, []);

  const isHighlighted = useCallback(
    (x: number, y: number) =>
      !placement && projectParcels.some(parcel => parcel.x === x && parcel.y === y),
    [placement, projectParcels],
  );

  const isPlaced = useCallback(
    (x: number, y: number) => {
      if (!placement) return false;
      const placedParcels = calculateParcels(project, placement);
      return placedParcels.some(parcel => parcel.x === x && parcel.y === y);
    },
    [project, placement],
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
          scale: 1.5,
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
        return { color: isValid || placed ? COLORS.selected : COLORS.indicator, scale: 1.2 };
      }
      return null;
    },
    [isHighlighted, isValid, isPlaced],
  );

  const ownedLayer = useCallback(
    (x: number, y: number) => {
      const key = `${x},${y}`;
      return landTiles[key] && landTiles[key].land.owner === tiles[key].owner
        ? { color: COLORS.freeParcel }
        : null;
    },
    [tiles, landTiles],
  );

  const handlePlacement = useCallback(
    (x: number, y: number) => {
      if (!isValid) return;

      const newPlacement = { x, y };
      setPlacement(newPlacement);

      updateProject({
        ...project,
        scene: {
          ...project.scene,
          base: `${x},${y}`,
          parcels: calculateParcels(project, newPlacement).map(({ x, y }) => `${x},${y}`),
        },
        worldConfiguration: undefined, // Cannot deploy to a LAND with a world configuration
      });
    },
    [project, isValid, updateProject],
  );

  const handleClearPlacement = useCallback(() => {
    setPlacement(null);
  }, []);

  return (
    <Box>
      <Box
        height={480}
        style={{ backgroundColor: 'black' }}
      >
        <Atlas
          tiles={tiles}
          layers={[strokeLayer, highlightLayer, ownedLayer]}
          onHover={handleHover}
          onClick={handlePlacement}
          withZoomControls
        />
      </Box>
      <Box
        mt={4}
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
                  coords: project.scene.base,
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
          onClick={handleClickPublish}
          disabled={!placement}
          sx={{ height: '45px' }}
        >
          {t('modal.publish_project.land.select_parcel.actions.publish')}
        </Button>
      </Box>
    </Box>
  );
}
