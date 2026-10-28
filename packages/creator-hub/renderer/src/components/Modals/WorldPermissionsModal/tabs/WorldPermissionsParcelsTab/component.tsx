import React, { useCallback, useMemo, useState } from 'react';
import { useDispatch, useSelector } from '#store';
import { t } from '/@/modules/store/translation/utils';
import type { WorldScene } from '/@/lib/worlds';
import { WorldPermissionName } from '/@/lib/worlds';
import {
  actions as managementActions,
  selectors as managementSelectors,
} from '/@/modules/store/management';
import { ParcelPicker } from '/@/components/ParcelPicker';

type Props = {
  worldName: string;
  worldScenes: WorldScene[];
  walletAddress: string;
  onGoBack: () => void;
};

const WorldPermissionsParcelsTab: React.FC<Props> = React.memo(
  ({ walletAddress, worldName, worldScenes, onGoBack }) => {
    const [isSaving, setIsSaving] = useState(false);
    const initialParcelsState = useSelector(state =>
      managementSelectors.getParcelsStateForAddress(state, walletAddress),
    );
    const initialParcels = useMemo(
      () => new Set(initialParcelsState?.parcels || []),
      [initialParcelsState],
    );
    const dispatch = useDispatch();

    const handleSave = useCallback(
      async (selected: string[]) => {
        const selectedParcels = new Set(selected);
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
      },
      [initialParcels, worldName, walletAddress, onGoBack],
    );

    return (
      <ParcelPicker
        walletAddress={walletAddress}
        scenes={worldScenes}
        initialParcels={initialParcels}
        title={t('modal.world_permissions.parcels.title')}
        description={t('parcel_picker.description')}
        saving={isSaving}
        onConfirm={parcels => void handleSave(parcels)}
        onGoBack={onGoBack}
      />
    );
  },
);

export { WorldPermissionsParcelsTab };
