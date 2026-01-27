import React, { useCallback, useMemo } from 'react';
import ParcelsIcon from '@mui/icons-material/GridViewRounded';
import { Atlas } from 'decentraland-ui2/dist/components/Atlas/Atlas';
import type { AtlasProps } from 'decentraland-ui2/dist/components/Atlas/Atlas.types';
import { Box, Typography } from 'decentraland-ui2';
import type { WorldScene } from '/@/lib/worlds';
import { t } from '/@/modules/store/translation/utils';
import { getSceneParcelsSet, getWorldDimensions } from './utils';
import { WORLD_ATLAS_COLORS } from './constants';
import './styles.css';

type Props = Partial<AtlasProps> & {
  worldScenes: WorldScene[];
};

const WorldAtlas: React.FC<Props> = React.memo(({ worldScenes, ...props }) => {
  const dimensions = useMemo(() => getWorldDimensions(worldScenes), [worldScenes]);
  const sceneParcels = useMemo(() => getSceneParcelsSet(worldScenes), [worldScenes]);

  const worldSize = useMemo(() => {
    if (!dimensions.width || !dimensions.height) return '';
    return `${dimensions.width}x${dimensions.height}`;
  }, [dimensions]);

  const worldLayer = useCallback(
    (x: number, y: number) => {
      return x >= dimensions.minX &&
        x <= dimensions.maxX &&
        y >= dimensions.minY &&
        y <= dimensions.maxY
        ? { color: WORLD_ATLAS_COLORS.worldParcel, scale: 1.0 }
        : null;
    },
    [dimensions],
  );

  const scenesLayer = useCallback(
    (x: number, y: number) => {
      const key = `${x},${y}`;
      return sceneParcels.has(key) ? { color: WORLD_ATLAS_COLORS.sceneParcel, scale: 1.0 } : null;
    },
    [sceneParcels],
  );

  const centerX = Math.floor((dimensions.minX + dimensions.maxX) / 2);
  const centerY = Math.floor((dimensions.minY + dimensions.maxY) / 2);

  return (
    <Box
      className="WorldAtlasContainer"
      height={props.height ?? 480}
    >
      {/* @ts-expect-error TODO: Update properties in UI2, making the not required `optional` */}
      <Atlas
        {...props}
        layers={[worldLayer, scenesLayer]}
        isDraggable
        withZoomControls
        height={props.height ?? 480}
        x={centerX}
        y={centerY}
      />
      {worldSize && (
        <Box className="WorldSizeOverlay">
          <ParcelsIcon />
          <Typography variant="body2">
            {t('modal.world_settings.layout.world_layout.world_size', { size: worldSize })}
          </Typography>
        </Box>
      )}
    </Box>
  );
});

export { WorldAtlas };
