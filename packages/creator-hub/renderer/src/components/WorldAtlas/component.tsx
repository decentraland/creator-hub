import React, { useCallback, useMemo } from 'react';
import ParcelsIcon from '@mui/icons-material/GridViewRounded';
import { Atlas } from 'decentraland-ui2/dist/components/Atlas/Atlas';
import type { AtlasProps } from 'decentraland-ui2/dist/components/Atlas/Atlas.types';
import { Box, Typography } from 'decentraland-ui2';
import type { WorldScene } from '/@/lib/worlds';
import { getWorldDimensions } from '/@/modules/world';
import { t } from '/@/modules/store/translation/utils';
import './styles.css';

type Props = Partial<AtlasProps> & {
  worldScenes: WorldScene[];
};

enum WorldAtlasColors {
  emptyParcel = '#0D0B0E',
  worldParcel = '#FF2D55',
  sceneParcel = '#1F87E5',
  selectedParcel = '#5E5B67',
  selectedStroke = '#FFFFFF',
}

const WorldAtlas: React.FC<Props> = React.memo(({ worldScenes, ...props }) => {
  const dimensions = useMemo(() => getWorldDimensions(worldScenes), [worldScenes]);

  const sceneParcelsSet = useMemo(
    () => new Set(worldScenes.flatMap(scene => scene.parcels ?? [])),
    [worldScenes],
  );

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
        ? { color: WorldAtlasColors.worldParcel, scale: 1.0 }
        : null;
    },
    [dimensions],
  );

  const scenesLayer = useCallback(
    (x: number, y: number) => {
      const key = `${x},${y}`;
      return sceneParcelsSet.has(key) ? { color: WorldAtlasColors.sceneParcel, scale: 1.0 } : null;
    },
    [sceneParcelsSet],
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
