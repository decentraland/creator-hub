import React, { useCallback, useState } from 'react';
import AddIcon from '@mui/icons-material/AddRounded';
import InfoIcon from '@mui/icons-material/InfoOutlined';
import { Box, Tooltip, Typography } from 'decentraland-ui2';
import { t, T } from '/@/modules/store/translation/utils';
import { WorldPermissionName, WorldPermissionType } from '/@/lib/worlds';
import type {
  AddressWorldPermission,
  AllowListPermissionSetting,
  UnrestrictedPermissionSetting,
} from '/@/lib/worlds';
import { Row } from '/@/components/Row';
import { Button } from '/@/components/Button';
import { WorldPermissionsAddCollaboratorDialog } from '../../WorldPermissionsAddCollaboratorDialog';
import {
  WorldPermissionsLoadingItem,
  WorldPermissionsCollaboratorsItem,
} from '../../WorldPermissionsItem';
import './styles.css';

const MAX_COLLABORATORS = 10;

type Props = {
  worldDeploymentPermissions: AllowListPermissionSetting;
  worldStreamingPermissions: AllowListPermissionSetting | UnrestrictedPermissionSetting;
  worldPermissionsSummary: Record<string, AddressWorldPermission[]>;
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
    collaboratorUsersList,
    isLoadingNewUser,
    onAddCollaborator,
    onRemoveCollaborator,
    onGrantWorldWideDeploymentPermission,
    onGrantParcelsDeploymentPermission,
  } = props;

  const [showAddDialog, setShowAddDialog] = useState(false);

  const handleOpenAddDialog = useCallback(() => {
    setShowAddDialog(true);
  }, []);

  const handleCloseAddDialog = useCallback(() => {
    setShowAddDialog(false);
  }, []);

  const handleAddCollaborator = useCallback(
    (address: string) => {
      onAddCollaborator(address);
      setShowAddDialog(false);
    },
    [onAddCollaborator],
  );

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

  return (
    <Box className="WorldCollaboratorsTab">
      <Typography variant="h6">
        <T
          id="modal.world_permissions.collaborators.description"
          values={{ span: (chunks: React.ReactNode) => <span>{chunks}</span> }}
        />
      </Typography>

      <Box className="CollaboratorsFormContainer">
        <Row className="CollaboratorsListHeader">
          <Typography
            variant="body2"
            className="CollaboratorsCount"
          >
            {t('modal.world_permissions.collaborators.column_name_label', {
              number: `${collaboratorsCount}/${MAX_COLLABORATORS}`,
            })}
          </Typography>
          <Button
            onClick={handleOpenAddDialog}
            color="primary"
            startIcon={<AddIcon />}
          >
            {t('modal.world_permissions.collaborators.add')}
          </Button>
        </Row>

        <Box className="CollaboratorsList">
          {collaboratorsCount > 0 ? (
            <>
              <Row className="TableRow CollaboratorsHeaderRow">
                <Typography
                  variant="body2"
                  className="CollaboratorsHeader"
                >
                  {t('modal.world_permissions.collaborators.column_collaborators')}
                </Typography>
                <Typography
                  variant="body2"
                  className="LocationHeader"
                >
                  {t('modal.world_permissions.collaborators.column_deploy_label')}
                  <Tooltip
                    title={t('modal.world_permissions.collaborators.column_deploy_tooltip')}
                    placement="top"
                    arrow
                  >
                    <InfoIcon />
                  </Tooltip>
                </Typography>
              </Row>
              {collaboratorUsersList.map(wallet => {
                return (
                  <WorldPermissionsCollaboratorsItem
                    key={wallet}
                    walletAddress={wallet.toLowerCase()}
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
            </>
          ) : (
            !isLoadingNewUser && (
              <Typography className="EmptyList">
                {t('modal.world_permissions.collaborators.empty_list')}
              </Typography>
            )
          )}
          {isLoadingNewUser && <WorldPermissionsLoadingItem />}
        </Box>
      </Box>

      <WorldPermissionsAddCollaboratorDialog
        open={showAddDialog}
        onClose={handleCloseAddDialog}
        onSubmit={handleAddCollaborator}
      />
    </Box>
  );
});

export { WorldPermissionsCollaboratorsTab };
