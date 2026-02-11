import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBackRounded';
import { Box, Typography } from 'decentraland-ui2';
import { useDispatch, useSelector } from '#store';
import { t } from '/@/modules/store/translation/utils';
import { coordsToId } from '/@/lib/land';
import type { WorldScene } from '/@/lib/worlds';
import { WorldPermissionName } from '/@/lib/worlds';
import { MAX_COORDINATE, MIN_COORDINATE } from '/@/modules/world';
import {
  actions as managementActions,
  selectors as managementSelectors,
} from '/@/modules/store/management';
import { WorldAtlas, WorldAtlasColors } from '/@/components/WorldAtlas';
import { Button } from '/@/components/Button';
import { Loader } from '/@/components/Loader';
import { WorldPermissionsAvatarWithInfo } from '../../WorldPermissionsAvatarWithInfo';
import './styles.css';

type Props = {
  worldName: string;
  worldScenes: WorldScene[];
  walletAddress: string;
  onGoBack: () => void;
};

const RIGHT_MOUSE_BUTTON_CLICK = 2;

const WorldPermissionsParcelsTab: React.FC<Props> = React.memo(
  ({ walletAddress, worldName, worldScenes, onGoBack }) => {
    const [selectedParcels, setSelectedParcels] = useState<Set<string>>(new Set());
    const [dragStatus, setDragStatus] = useState<{
      isSelectingParcels: boolean; // When false dragging moves map, when true dragging selects parcels.
      from: { x: number; y: number } | null;
      to: { x: number; y: number } | null;
    }>({ isSelectingParcels: false, from: null, to: null });
    const [isSaving, setIsSaving] = useState(false);
    const hasChangesRef = useRef(false);
    const initialParcelsState = useSelector(state =>
      managementSelectors.getParcelsStateForAddress(state, walletAddress),
    );
    const initialParcels = useMemo(
      () => new Set(initialParcelsState?.parcels || []),
      [initialParcelsState],
    );
    const dispatch = useDispatch();

    useEffect(() => {
      setSelectedParcels(initialParcels);
      hasChangesRef.current = false;
    }, [initialParcels]);

    const isWithinWorldBounds = useCallback(
      (x: number, y: number) =>
        x >= MIN_COORDINATE && x <= MAX_COORDINATE && y >= MIN_COORDINATE && y <= MAX_COORDINATE,
      [],
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
      // If selection is enabled and it's not a right click, avoid moving the atlas when dragging and allow selecting parcels instead.
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
        // Calculate the parcels list between the from and to coordinates.
        const minX = Math.min(dragStatus.from.x, dragStatus.to.x);
        const maxX = Math.max(dragStatus.from.x, dragStatus.to.x);
        const minY = Math.min(dragStatus.from.y, dragStatus.to.y);
        const maxY = Math.max(dragStatus.from.y, dragStatus.to.y);
        setSelectedParcels(prevParcels => {
          const nextParcels = new Set(prevParcels);
          for (let px = minX; px <= maxX; px++) {
            for (let py = minY; py <= maxY; py++) {
              nextParcels.add(coordsToId(px, py));
            }
          }
          return nextParcels;
        });
        hasChangesRef.current = true;
      }
      setDragStatus({ isSelectingParcels: false, from: null, to: null });
    }, [dragStatus]);

    const handleSave = useCallback(async () => {
      const parcelsToAdd = Array.from(selectedParcels).filter(
        parcel => !initialParcels.has(parcel),
      );
      const parcelsToRemove = Array.from(initialParcels).filter(
        parcel => !selectedParcels.has(parcel),
      );

      try {
        const tasks: Promise<void>[] = [];
        setIsSaving(true);
        if (parcelsToAdd.length > 0) {
          tasks.push(
            dispatch(
              managementActions.addParcelsPermission({
                worldName,
                permissionName: WorldPermissionName.Deployment,
                walletAddress,
                parcels: parcelsToAdd,
              }),
            ).unwrap(),
          );
        }
        if (parcelsToRemove.length > 0) {
          tasks.push(
            dispatch(
              managementActions.removeParcelsPermission({
                worldName,
                permissionName: WorldPermissionName.Deployment,
                walletAddress,
                parcels: parcelsToRemove,
              }),
            ).unwrap(),
          );
        }
        await Promise.all(tasks);
        onGoBack();
      } finally {
        setIsSaving(false);
      }
    }, [selectedParcels, initialParcels, worldName, walletAddress, onGoBack]);

    const handleReset = useCallback(() => {
      setSelectedParcels(initialParcels);
      hasChangesRef.current = false;
    }, [initialParcels]);

    return (
      <Box className="WorldPermissionsParcelsTab">
        <Box className="HeaderTitle">
          <ArrowBackIcon
            role="button"
            onClick={onGoBack}
          />
          <Typography variant="h6">{t('modal.world_permissions.parcels.title')}</Typography>
        </Box>
        <Typography
          variant="h6"
          className="Description"
        >
          {t('modal.world_permissions.parcels.description')}
        </Typography>
        <WorldAtlas
          height={350}
          worldScenes={worldScenes}
          showWorldSize={false}
          floatingContent={
            <WorldPermissionsAvatarWithInfo
              walletAddress={walletAddress}
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
            onClick={handleSave}
            disabled={!hasChangesRef.current}
            className="SaveButton"
          >
            {isSaving ? <Loader size={24} /> : t('modal.world_permissions.parcels.actions.confirm')}
          </Button>
        </Box>
      </Box>
    );
  },
);

export { WorldPermissionsParcelsTab };
