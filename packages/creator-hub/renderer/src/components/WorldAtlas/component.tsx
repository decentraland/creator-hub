import React, { useCallback, useMemo } from 'react';
import ParcelsIcon from '@mui/icons-material/GridViewRounded';
import { Atlas } from 'decentraland-ui2/dist/components/Atlas/Atlas';
import type { AtlasProps } from 'decentraland-ui2/dist/components/Atlas/Atlas.types';
import { Box, Typography } from 'decentraland-ui2';
import type { WorldScene } from '/@/lib/worlds';
import { coordsToId } from '/@/lib/land';
import { getWorldDimensions, MAX_COORDINATE, MIN_COORDINATE } from '/@/modules/world';
import { t } from '/@/modules/store/translation/utils';
import './styles.css';

export type AtlasScene = Pick<WorldScene, 'parcels'>;

type Props = Partial<AtlasProps> & {
  worldScenes: AtlasScene[];
  showWorldSize?: boolean;
  floatingContent?: React.ReactNode;
  colorsOverride?: Partial<Record<keyof typeof WorldAtlasColors, string>>;
  onMouseDownEvent?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
};

export const WorldAtlasColors = {
  noPermissionParcel: '#000000CC', // Black semi-transparent overlay
  unavailableParcel: '#000000', // Black
  availableParcel: 'transparent', // Default tiles color.
  worldParcel: '#FF2D55', // Red
  sceneParcel: '#1F87E5', // Blue
  selectedParcel: '#FF9990', // Pink
  selectedStroke: '#FF0044', // Red
} as const;

const WorldAtlas: React.FC<Props> = React.memo(
  ({
    worldScenes,
    floatingContent,
    showWorldSize = true,
    isDraggable = true,
    withZoomControls = true,
    height = 480,
    colorsOverride = {},
    onMouseDownEvent,
    onMouseEnter,
    onMouseLeave,
    ...props
  }) => {
    const dimensions = useMemo(() => getWorldDimensions(worldScenes), [worldScenes]);
    const centerX = Math.floor((dimensions.minX + dimensions.maxX) / 2);
    const centerY = Math.floor((dimensions.minY + dimensions.maxY) / 2);

    const colors = useMemo(
      () => (colorsOverride ? { ...WorldAtlasColors, ...colorsOverride } : WorldAtlasColors),
      [colorsOverride],
    );

    const sceneParcelsSet = useMemo(
      () => new Set(worldScenes.flatMap(scene => scene.parcels ?? [])),
      [worldScenes],
    );

    const worldSize = useMemo(() => {
      if (!dimensions.width || !dimensions.height) return '';
      return `${dimensions.width}x${dimensions.height}`;
    }, [dimensions]);

    const isWithinWorldBounds = useCallback(
      (x: number, y: number) =>
        x >= MIN_COORDINATE && x <= MAX_COORDINATE && y >= MIN_COORDINATE && y <= MAX_COORDINATE,
      [],
    );

    const emptyParcelLayer = useCallback(
      (x: number, y: number) =>
        isWithinWorldBounds(x, y)
          ? { color: colors.availableParcel }
          : { color: colors.unavailableParcel },
      [isWithinWorldBounds, colors],
    );

    const worldLayer = useCallback(
      (x: number, y: number) => {
        return dimensions.width > 0 &&
          x >= dimensions.minX &&
          x <= dimensions.maxX &&
          y >= dimensions.minY &&
          y <= dimensions.maxY
          ? { color: colors.worldParcel }
          : null;
      },
      [dimensions, colors],
    );

    const scenesLayer = useCallback(
      (x: number, y: number) => {
        const key = coordsToId(x, y);
        return sceneParcelsSet.has(key) ? { color: colors.sceneParcel } : null;
      },
      [sceneParcelsSet, colors],
    );

    return (
      <Box
        className="WorldAtlasContainer"
        height={height}
        onMouseDown={onMouseDownEvent}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {/* @ts-expect-error TODO: Update properties in UI2, making the not required `optional` */}
        <Atlas
          {...props}
          layers={[emptyParcelLayer, worldLayer, scenesLayer, ...(props.layers ?? [])]}
          isDraggable={isDraggable}
          withZoomControls={withZoomControls}
          height={height}
          x={props.x ?? centerX}
          y={props.y ?? centerY}
        />
        {(floatingContent || (showWorldSize && worldSize)) && (
          <Box className="TopLeftOverlay">
            {showWorldSize && worldSize && (
              <Box className="WorldSize">
                <ParcelsIcon />
                <Typography variant="body2">
                  {t('modal.world_settings.layout.world_layout.world_size', { size: worldSize })}
                </Typography>
              </Box>
            )}
            {floatingContent}
          </Box>
        )}
      </Box>
    );
  },
);

export { WorldAtlas };
