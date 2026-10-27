import React, { useCallback, useEffect, useRef, useState } from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBackRounded';
import { Box, Typography } from 'decentraland-ui2';
import { t } from '/@/modules/store/translation/utils';
import { coordsToId } from '/@/lib/land';
import { MAX_COORDINATE, MIN_COORDINATE } from '/@/modules/world';
import { WorldAtlas, WorldAtlasColors, type AtlasScene } from '/@/components/WorldAtlas';
import { Button } from '/@/components/Button';
import { Loader } from '/@/components/Loader';
import { WorldPermissionsAvatarWithInfo } from '../Modals/WorldPermissionsModal/WorldPermissionsAvatarWithInfo';
import './styles.css';

type Props = {
  walletAddress: string;
  scenes: AtlasScene[];
  initialParcels: Set<string>;
  allowed?: Set<string>;
  title: string;
  description: string;
  saving: boolean;
  onConfirm: (parcels: string[]) => void;
  onGoBack: () => void;
};

const RIGHT_MOUSE_BUTTON_CLICK = 2;

/** Picks parcels on the atlas by click or drag, optionally limited to an allowed set. */
export const ParcelPicker: React.FC<Props> = React.memo(
  ({
    walletAddress,
    scenes,
    initialParcels,
    allowed,
    title,
    description,
    saving,
    onConfirm,
    onGoBack,
  }) => {
    const [selectedParcels, setSelectedParcels] = useState<Set<string>>(new Set());
    const [dragStatus, setDragStatus] = useState<{
      isSelectingParcels: boolean;
      from: { x: number; y: number } | null;
      to: { x: number; y: number } | null;
    }>({ isSelectingParcels: false, from: null, to: null });
    const hasChangesRef = useRef(false);

    useEffect(() => {
      setSelectedParcels(initialParcels);
      hasChangesRef.current = false;
    }, [initialParcels]);

    const isWithinWorldBounds = useCallback(
      (x: number, y: number) =>
        allowed
          ? allowed.has(coordsToId(x, y))
          : x >= MIN_COORDINATE &&
            x <= MAX_COORDINATE &&
            y >= MIN_COORDINATE &&
            y <= MAX_COORDINATE,
      [allowed],
    );

    const isHoverSelectedParcel = useCallback(
      (x: number, y: number) => {
        return (
          dragStatus.isSelectingParcels &&
          dragStatus.from &&
          dragStatus.to &&
          x >= Math.min(dragStatus.from.x, dragStatus.to.x) &&
          x <= Math.max(dragStatus.from.x, dragStatus.to.x) &&
          y >= Math.min(dragStatus.from.y, dragStatus.to.y) &&
          y <= Math.max(dragStatus.from.y, dragStatus.to.y)
        );
      },
      [dragStatus],
    );

    const selectedParcelsLayer = useCallback(
      (x: number, y: number) => {
        const key = coordsToId(x, y);
        return selectedParcels.has(key) || isHoverSelectedParcel(x, y)
          ? { color: WorldAtlasColors.selectedParcel, scale: 1.0 }
          : null;
      },
      [selectedParcels, isHoverSelectedParcel],
    );

    const selectedParcelsStrokeLayer = useCallback(
      (x: number, y: number) => {
        const key = coordsToId(x, y);
        return selectedParcels.has(key) || isHoverSelectedParcel(x, y)
          ? { color: WorldAtlasColors.selectedStroke, scale: 1.3 }
          : null;
      },
      [selectedParcels, isHoverSelectedParcel],
    );

    const handleMouseDownClickType = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== RIGHT_MOUSE_BUTTON_CLICK) {
        setDragStatus(prevDragStatus => ({ ...prevDragStatus, isSelectingParcels: true }));
      }
    }, []);

    const handleParcelClick = useCallback(
      (x: number, y: number) => {
        if (!isWithinWorldBounds(x, y)) return;

        const key = coordsToId(x, y);
        setSelectedParcels(prevParcels => {
          const nextParcels = new Set(prevParcels);
          if (nextParcels.has(key)) nextParcels.delete(key);
          else nextParcels.add(key);
          return nextParcels;
        });
        hasChangesRef.current = true;
      },
      [isWithinWorldBounds],
    );

    const handleMouseDown = useCallback((x: number, y: number) => {
      setDragStatus(prevDragStatus => ({ ...prevDragStatus, from: { x, y }, to: { x, y } }));
    }, []);

    const handleParcelHover = useCallback(
      (x: number, y: number) => {
        if (dragStatus.isSelectingParcels && dragStatus.from && isWithinWorldBounds(x, y)) {
          setDragStatus(prevDragStatus => ({ ...prevDragStatus, to: { x, y } }));
        }
      },
      [dragStatus, isWithinWorldBounds],
    );

    const handleMouseUp = useCallback(() => {
      if (
        dragStatus.isSelectingParcels &&
        dragStatus.from &&
        dragStatus.to &&
        (dragStatus.from.x !== dragStatus.to.x || dragStatus.from.y !== dragStatus.to.y)
      ) {
        const minX = Math.min(dragStatus.from.x, dragStatus.to.x);
        const maxX = Math.max(dragStatus.from.x, dragStatus.to.x);
        const minY = Math.min(dragStatus.from.y, dragStatus.to.y);
        const maxY = Math.max(dragStatus.from.y, dragStatus.to.y);
        setSelectedParcels(prevParcels => {
          const nextParcels = new Set(prevParcels);
          for (let px = minX; px <= maxX; px++) {
            for (let py = minY; py <= maxY; py++) {
              if (isWithinWorldBounds(px, py)) nextParcels.add(coordsToId(px, py));
            }
          }
          return nextParcels;
        });
        hasChangesRef.current = true;
      }
      setDragStatus({ isSelectingParcels: false, from: null, to: null });
    }, [dragStatus, isWithinWorldBounds]);

    const handleReset = useCallback(() => {
      setSelectedParcels(initialParcels);
      hasChangesRef.current = false;
    }, [initialParcels]);

    return (
      <Box className="ParcelPicker">
        <Box className="HeaderTitle">
          <ArrowBackIcon
            role="button"
            onClick={onGoBack}
          />
          <Typography variant="h6">{title}</Typography>
        </Box>
        <Typography
          variant="h6"
          className="Description"
        >
          {description}
        </Typography>
        <WorldAtlas
          height={350}
          worldScenes={scenes}
          showWorldSize={false}
          floatingContent={
            <WorldPermissionsAvatarWithInfo
              value={walletAddress}
              size="tiny"
            />
          }
          isDraggable={!dragStatus.isSelectingParcels}
          layers={[selectedParcelsStrokeLayer, selectedParcelsLayer]}
          onClick={handleParcelClick}
          onHover={handleParcelHover}
          onMouseDownEvent={handleMouseDownClickType}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
        <Box className="ActionsContainer">
          {hasChangesRef.current && (
            <Button
              onClick={handleReset}
              variant="outlined"
              color="secondary"
            >
              {t('modal.world_permissions.parcels.actions.discard')}
            </Button>
          )}
          <Typography>
            {t('modal.world_permissions.parcels.parcels_count', {
              count: selectedParcels.size || '',
            })}
          </Typography>
          <Button
            onClick={() => onConfirm(Array.from(selectedParcels))}
            disabled={!hasChangesRef.current}
            className="SaveButton"
          >
            {saving ? <Loader size={24} /> : t('modal.world_permissions.parcels.actions.confirm')}
          </Button>
        </Box>
      </Box>
    );
  },
);
