import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBackRounded';
import { Box, Chip, Typography } from 'decentraland-ui2';
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
    const parcelsStateSelector = useMemo(
      () => managementSelectors.makeParcelsStateForAddressSelector(),
      [],
    );
    const initialParcelsState = useSelector(state =>
      parcelsStateSelector(state.management, walletAddress),
    );
    const initialParcels = useMemo(
      () => new Set(initialParcelsState?.parcels || []),
      [initialParcelsState],
    );
    const dispatch = useDispatch();

    useEffect(() => {
      setSelectedParcels(initialParcels);
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
      }
      setDragStatus({ isSelectingParcels: false, from: null, to: null });
    }, [dragStatus]);

    const handleGoBack = useCallback(() => {
      const parcelsToAdd = Array.from(selectedParcels).filter(
        parcel => !initialParcels.has(parcel),
      );
      const parcelsToRemove = Array.from(initialParcels).filter(
        parcel => !selectedParcels.has(parcel),
      );

      if (parcelsToAdd.length > 0) {
        dispatch(
          managementActions.addParcelsPermission({
            worldName,
            permissionName: WorldPermissionName.Deployment,
            walletAddress,
            parcels: parcelsToAdd,
          }),
        );
      }

      if (parcelsToRemove.length > 0) {
        dispatch(
          managementActions.removeParcelsPermission({
            worldName,
            permissionName: WorldPermissionName.Deployment,
            walletAddress,
            parcels: parcelsToRemove,
          }),
        );
      }

      onGoBack();
    }, [selectedParcels, initialParcels, worldName, walletAddress, onGoBack]);

    return (
      <Box className="WorldPermissionsParcelsTab">
        <Box className="HeaderTitle">
          <ArrowBackIcon
            role="button"
            onClick={handleGoBack}
          />
          <Typography variant="h6">{t('modal.world_permissions.parcels.title')}</Typography>
        </Box>
        <Typography
          variant="h6"
          className="Description"
        >
          {t('modal.world_permissions.parcels.description')}
        </Typography>
        <Box>
          <Box className="AtlasHeader">
            <WorldPermissionsAvatarWithInfo walletAddress={walletAddress} />
            <Chip
              label={t('modal.world_permissions.parcels.parcels_count', {
                count: selectedParcels.size,
              })}
              className="ParcelsCount"
            />
          </Box>
          <WorldAtlas
            height={350}
            worldScenes={worldScenes}
            isDraggable={!dragStatus.isSelectingParcels}
            layers={[selectedParcelsStrokeLayer, selectedParcelsLayer]}
            onClick={handleParcelClick}
            onHover={handleParcelHover}
            onMouseDownEvent={handleMouseDownClickType}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </Box>
      </Box>
    );
  },
);

export { WorldPermissionsParcelsTab };
