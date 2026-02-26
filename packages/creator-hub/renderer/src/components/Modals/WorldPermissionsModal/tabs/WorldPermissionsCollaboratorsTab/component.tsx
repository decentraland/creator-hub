import React, { useCallback, useState } from 'react';
import AddIcon from '@mui/icons-material/AddRounded';
import { Box, Button as DCLButton, Typography } from 'decentraland-ui2';
import { t } from '/@/modules/store/translation/utils';
import { WorldPermissionName, WorldPermissionType, WorldRoleType } from '/@/lib/worlds';
import type {
  AddressWorldPermission,
  AllowListPermissionSetting,
  UnrestrictedPermissionSetting,
} from '/@/lib/worlds';
import { Row } from '/@/components/Row';
import { Button } from '/@/components/Button';
import { ConfirmationPanel } from '/@/components/ConfirmationPanel';
import { WorldPermissionsAddCollaboratorDialog } from '../../WorldPermissionsAddCollaboratorDialog';
import {
  WorldPermissionsLoadingItem,
  WorldPermissionsCollaboratorsItem,
} from '../../WorldPermissionsItem';
import './styles.css';

const MAX_COLLABORATORS = 10;

function noop() {}

type Props = {
  worldDeploymentPermissions: AllowListPermissionSetting;
  worldStreamingPermissions: AllowListPermissionSetting | UnrestrictedPermissionSetting;
  worldPermissionsSummary: Record<string, AddressWorldPermission[]>;
  worldOwnerAddress: string;
  collaboratorUsersList: string[];
  isLoadingNewUser: boolean;
  onAddCollaborator: (address: string) => void;
  onRemoveCollaborator: (address: string) => void;
  onGrantWorldWideDeploymentPermission: (address: string) => void;
  onGrantParcelsDeploymentPermission: (address: string) => void;
};

const WorldPermissionsCollaboratorsTab: React.FC<Props> = React.memo(props => {
  const {
    worldDeploymentPermissions,
    worldStreamingPermissions,
    worldPermissionsSummary,
    worldOwnerAddress,
    collaboratorUsersList,
    isLoadingNewUser,
    onAddCollaborator,
    onRemoveCollaborator,
    onGrantWorldWideDeploymentPermission,
    onGrantParcelsDeploymentPermission,
  } = props;
  const [currentForm, setCurrentForm] = useState<'add' | 'clear_confirmation' | null>(null);

  const handleCloseForm = useCallback(() => {
    setCurrentForm(null);
  }, []);

  const handleAddCollaborator = useCallback(
    (address: string) => {
      onAddCollaborator(address);
      setCurrentForm(null);
    },
    [onAddCollaborator],
  );

  const handleClearList = useCallback(() => {
    collaboratorUsersList.forEach(wallet => onRemoveCollaborator(wallet));
    setCurrentForm(null);
  }, [collaboratorUsersList, onRemoveCollaborator]);

  const getAllowedParcelsCount = useCallback(
    (wallet: string) => {
      const walletDeploySummary = worldPermissionsSummary[wallet]?.find(
        $ => $.permission === WorldPermissionName.Deployment,
      );
      if (!walletDeploySummary || walletDeploySummary.worldWide) return 0;
      return walletDeploySummary.parcelCount;
    },
    [worldPermissionsSummary],
  );

  const collaboratorsCount = collaboratorUsersList?.length || 0;

  if (currentForm === 'add') {
    return (
      <Box className="WorldCollaboratorsTab CenteredContent">
        <WorldPermissionsAddCollaboratorDialog
          onCancel={handleCloseForm}
          onSubmit={handleAddCollaborator}
        />
      </Box>
    );
  }

  if (currentForm === 'clear_confirmation') {
    return (
      <Box className="WorldCollaboratorsTab CenteredContent">
        <ConfirmationPanel
          title={t('modal.world_permissions.collaborators.clear_list_title')}
          warning={t('modal.world_permissions.collaborators.clear_list_warning')}
          cancelLabel={t('modal.cancel')}
          confirmLabel={t('modal.confirm')}
          onCancel={handleCloseForm}
          onConfirm={handleClearList}
        />
      </Box>
    );
  }

  return (
    <Box className="WorldCollaboratorsTab">
      <Typography variant="h6">
        {t('modal.world_permissions.collaborators.description', {
          span: (chunks: React.ReactNode) => <span>{chunks}</span>,
        })}
      </Typography>

      {collaboratorsCount > 0 ? (
        <Box className="CollaboratorsList">
          <Row className="CollaboratorsHeaderRow">
            <Typography variant="h6">
              {t('modal.world_permissions.collaborators.column_name_label', {
                number: `${collaboratorsCount}/${MAX_COLLABORATORS}`,
              })}
            </Typography>
            <DCLButton
              color="secondary"
              className="ClearListLink"
              onClick={() => setCurrentForm('clear_confirmation')}
            >
              {t('modal.world_permissions.collaborators.actions.clear_list')}
            </DCLButton>
            <Button
              onClick={() => setCurrentForm('add')}
              color="primary"
              startIcon={<AddIcon />}
              disabled={collaboratorsCount >= MAX_COLLABORATORS}
            >
              {t('modal.world_permissions.collaborators.add')}
            </Button>
          </Row>
          <WorldPermissionsCollaboratorsItem
            key={worldOwnerAddress}
            walletAddress={worldOwnerAddress.toLowerCase()}
            role={WorldRoleType.OWNER}
            hasDeploymentPermission
            hasStreamingPermission
            onRemoveCollaborator={noop}
            onGrantWorldWideDeploymentPermission={noop}
            onGrantParcelsDeploymentPermission={noop}
          />
          {collaboratorUsersList.map(wallet => {
            const lowerWallet = wallet.toLowerCase();
            if (lowerWallet === worldOwnerAddress.toLowerCase()) return null; // we already render the owner as the first item in the list, so we skip it here to avoid duplicates.
            return (
              <WorldPermissionsCollaboratorsItem
                key={wallet}
                walletAddress={lowerWallet}
                role={WorldRoleType.COLLABORATOR}
                onRemoveCollaborator={() => onRemoveCollaborator(wallet)}
                hasDeploymentPermission={!!worldDeploymentPermissions.wallets?.includes(wallet)}
                hasStreamingPermission={
                  worldStreamingPermissions.type === WorldPermissionType.AllowList &&
                  !!worldStreamingPermissions.wallets?.includes(wallet)
                }
                allowedParcelsCount={getAllowedParcelsCount(wallet)}
                onGrantWorldWideDeploymentPermission={() =>
                  onGrantWorldWideDeploymentPermission(wallet)
                }
                onGrantParcelsDeploymentPermission={() =>
                  onGrantParcelsDeploymentPermission(wallet)
                }
              />
            );
          })}

          {isLoadingNewUser && <WorldPermissionsLoadingItem />}
        </Box>
      ) : (
        <Box className="EmptyStateContainer">
          <Typography>{t('modal.world_permissions.collaborators.empty_list')}</Typography>

          <Button
            onClick={() => setCurrentForm('add')}
            color="primary"
            startIcon={<AddIcon />}
          >
            {t('modal.world_permissions.collaborators.add')}
          </Button>
        </Box>
      )}
    </Box>
  );
});

export { WorldPermissionsCollaboratorsTab };
