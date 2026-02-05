import React, { useCallback, useMemo, useState } from 'react';
import LockIcon from '@mui/icons-material/Lock';
import { t } from '/@/modules/store/translation/utils';
import {
  fetchParcelsPermission,
  addAddressPermission,
  removeAddressPermission,
  updateWorldPermissions,
  fetchWorldScenes,
  actions as managementActions,
} from '/@/modules/store/management';
import type { AddressWorldPermission, WorldScene } from '/@/lib/worlds';
import { WorldPermissionName, WorldPermissionType, type WorldPermissions } from '/@/lib/worlds';
import { useDispatch } from '#store';
import { Loader } from '../../Loader';
import { TabsModal, type Props as TabsModalProps } from '../TabsModal';
import { WorldPermissionsAccessTab } from './tabs/WorldPermissionsAccessTab';
import { WorldPermissionsCollaboratorsTab } from './tabs/WorldPermissionsCollaboratorsTab';
import { WorldPermissionsParcelsTab } from './tabs/WorldPermissionsParcelsTab';
import './styles.css';

enum WorldPermissionsTab {
  ACCESS = 'access',
  COLLABORATORS = 'collaborators',
}

const WORLD_PERMISSIONS_TABS: Array<{ label: string; value: WorldPermissionsTab }> = [
  {
    label: t('modal.world_permissions.tabs.access.label'),
    value: WorldPermissionsTab.ACCESS,
  },
  {
    label: t('modal.world_permissions.tabs.collaborators.label'),
    value: WorldPermissionsTab.COLLABORATORS,
  },
];

type Props = Pick<TabsModalProps<WorldPermissionsTab>, 'open' | 'onClose'> & {
  worldName: string;
  worldOwnerAddress: string;
  worldScenes: WorldScene[];
  worldPermissions?: WorldPermissions;
  worldPermissionsSummary?: Record<string, AddressWorldPermission[]>;
  isLoading: boolean;
  isLoadingNewUser: boolean;
  accessPassword?: string | null;
  isLoadingPassword?: boolean;
};

const WorldPermissionsModal: React.FC<Props> = React.memo(
  ({
    worldName,
    worldOwnerAddress,
    worldScenes,
    worldPermissions,
    worldPermissionsSummary,
    isLoading,
    isLoadingNewUser,
    accessPassword,
    isLoadingPassword = false,
    onClose,
    ...props
  }) => {
    const [activeTab, setActiveTab] = useState<WorldPermissionsTab>(WorldPermissionsTab.ACCESS);
    const [activeCollaboratorAddress, setActiveCollaboratorAddress] = useState<string | null>(null);
    const dispatch = useDispatch();

    const collaboratorUsersList = useMemo(
      () => Object.keys(worldPermissionsSummary || {}),
      [worldPermissionsSummary],
    );

    const handleTabClick = useCallback((tab: WorldPermissionsTab) => {
      setActiveTab(tab);
      setActiveCollaboratorAddress(null);
    }, []);

    const handleChangeAccessType = useCallback(
      (accessType: WorldPermissionType) => {
        if (!worldPermissions) return;
        dispatch(
          updateWorldPermissions({
            worldName,
            worldPermissionName: WorldPermissionName.Access,
            worldPermissionType: accessType,
          }),
        );
      },
      [worldName, worldPermissions],
    );

    const handleSetAccessPassword = useCallback(
      (password: string) => {
        dispatch(
          updateWorldPermissions({
            worldName,
            worldPermissionName: WorldPermissionName.Access,
            worldPermissionType: WorldPermissionType.SharedSecret,
            secret: password,
          }),
        );
      },
      [worldName],
    );

    const handleAddAccessToAddress = useCallback(
      (walletAddress: string) => {
        const formattedWalletAddress = walletAddress.toLowerCase();
        if (
          formattedWalletAddress !== worldOwnerAddress.toLowerCase() &&
          worldPermissions?.access.type === WorldPermissionType.AllowList &&
          !worldPermissions.access.wallets?.includes(formattedWalletAddress)
        ) {
          dispatch(
            addAddressPermission({
              worldName,
              permissionName: WorldPermissionName.Access,
              walletAddress: formattedWalletAddress,
            }),
          );
        }
      },
      [worldName, worldOwnerAddress, worldPermissions],
    );

    const handleRemoveAccessFromAddress = useCallback(
      (walletAddress: string) => {
        if (
          worldPermissions?.access.type === WorldPermissionType.AllowList &&
          worldPermissions.access.wallets?.includes(walletAddress)
        ) {
          dispatch(
            removeAddressPermission({
              worldName,
              permissionName: WorldPermissionName.Access,
              walletAddress,
            }),
          );
        }
      },
      [worldName, worldPermissions],
    );

    const handleAddCollaborator = useCallback(
      (walletAddress: string) => {
        const formattedWalletAddress = walletAddress.toLowerCase();
        if (
          formattedWalletAddress !== worldOwnerAddress.toLowerCase() &&
          worldPermissions &&
          !worldPermissions.deployment.wallets?.includes(formattedWalletAddress) &&
          (worldPermissions.streaming.type !== WorldPermissionType.AllowList ||
            !worldPermissions.streaming.wallets?.includes(formattedWalletAddress))
        ) {
          dispatch(
            addAddressPermission({
              worldName,
              permissionName: WorldPermissionName.Deployment,
              walletAddress: formattedWalletAddress,
            }),
          );
        }
      },
      [worldName, worldOwnerAddress, worldPermissions],
    );

    const handleRemoveCollaborator = useCallback(
      (walletAddress: string) => {
        // Delete the collaborator's deployment permission
        if (
          worldPermissions?.deployment.type === WorldPermissionType.AllowList &&
          worldPermissions.deployment.wallets?.includes(walletAddress)
        ) {
          dispatch(
            removeAddressPermission({
              worldName,
              permissionName: WorldPermissionName.Deployment,
              walletAddress,
            }),
          );
        }

        // Delete the collaborator's streaming permission
        if (
          worldPermissions?.streaming.type === WorldPermissionType.AllowList &&
          worldPermissions.streaming.wallets?.includes(walletAddress)
        ) {
          dispatch(
            removeAddressPermission({
              worldName,
              permissionName: WorldPermissionName.Streaming,
              walletAddress,
            }),
          );
        }
      },
      [worldName, worldPermissions],
    );

    const handleGrantWorldWideDeploymentPermission = useCallback(
      (walletAddress: string) => {
        // Put deployment permission will remove the parcels associated
        // with the permission and transform it into a world-wide permission.
        dispatch(
          addAddressPermission({
            worldName,
            permissionName: WorldPermissionName.Deployment,
            walletAddress: walletAddress.toLowerCase(),
          }),
        );
      },
      [worldName],
    );

    const handleGrantParcelsDeploymentPermission = useCallback(
      (walletAddress: string) => {
        setActiveCollaboratorAddress(walletAddress);
        dispatch(fetchWorldScenes({ worldName }));
        dispatch(
          fetchParcelsPermission({
            worldName,
            permissionName: WorldPermissionName.Deployment,
            walletAddress,
          }),
        );
      },
      [worldName],
    );

    const handleGoBackToCollaboratorsTab = useCallback(() => {
      setActiveCollaboratorAddress(null);
    }, []);

    const handleClose = useCallback(() => {
      // Reset state when the modal is closed.
      setActiveTab(WorldPermissionsTab.ACCESS);
      setActiveCollaboratorAddress(null);
      dispatch(managementActions.clearPermissionsState());
      onClose();
    }, [onClose]);

    return (
      <TabsModal
        {...props}
        title={t('modal.world_permissions.title', { worldName: worldName })}
        className="WorldPermissionsModal"
        icon={<LockIcon />}
        tabs={WORLD_PERMISSIONS_TABS}
        activeTab={activeTab}
        onTabClick={handleTabClick}
        onClose={handleClose}
      >
        {isLoading && !worldPermissions ? (
          <Loader />
        ) : (
          !!worldPermissions && (
            <>
              {activeTab === WorldPermissionsTab.ACCESS && (
                <WorldPermissionsAccessTab
                  worldAccessPermissions={worldPermissions?.access}
                  isLoadingNewUser={isLoadingNewUser}
                  accessPassword={accessPassword}
                  isLoadingPassword={isLoadingPassword}
                  onChangeAccessType={handleChangeAccessType}
                  onAddAccessToAddress={handleAddAccessToAddress}
                  onRemoveAccessFromAddress={handleRemoveAccessFromAddress}
                  onSetAccessPassword={handleSetAccessPassword}
                />
              )}
              {activeTab === WorldPermissionsTab.COLLABORATORS &&
                (!activeCollaboratorAddress ? (
                  <WorldPermissionsCollaboratorsTab
                    worldDeploymentPermissions={worldPermissions.deployment}
                    worldStreamingPermissions={worldPermissions.streaming}
                    worldPermissionsSummary={worldPermissionsSummary || {}}
                    collaboratorUsersList={collaboratorUsersList}
                    isLoadingNewUser={isLoadingNewUser}
                    onAddCollaborator={handleAddCollaborator}
                    onRemoveCollaborator={handleRemoveCollaborator}
                    onGrantWorldWideDeploymentPermission={handleGrantWorldWideDeploymentPermission}
                    onGrantParcelsDeploymentPermission={handleGrantParcelsDeploymentPermission}
                  />
                ) : (
                  <WorldPermissionsParcelsTab
                    worldName={worldName}
                    worldScenes={worldScenes || []}
                    walletAddress={activeCollaboratorAddress ?? ''}
                    onGoBack={handleGoBackToCollaboratorsTab}
                  />
                ))}
            </>
          )
        )}
      </TabsModal>
    );
  },
);

export { WorldPermissionsModal };
