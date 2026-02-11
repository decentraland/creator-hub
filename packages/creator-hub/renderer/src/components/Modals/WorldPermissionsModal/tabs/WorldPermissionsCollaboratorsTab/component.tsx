import React, { useCallback } from 'react';
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
import { WorldPermissionsAddUserForm } from '../../WorldPermissionsAddUserForm';
import {
  WorldPermissionsLoadingItem,
  WorldPermissionsCollaboratorsItem,
} from '../../WorldPermissionsItem';
import './styles.css';

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

  return (
    <Box className="WorldCollaboratorsTab">
      <Typography variant="h6">
        <T
          id="modal.world_permissions.collaborators.description"
          values={{ span: (chunks: React.ReactNode) => <span>{chunks}</span> }}
        />
      </Typography>

      <Box className="CollaboratorsFormContainer">
        <WorldPermissionsAddUserForm
          addButtonLabel={t('modal.world_permissions.collaborators.add_collaborator')}
          onSubmitAddress={onAddCollaborator}
        />
        <Box className="CollaboratorsList">
          {collaboratorUsersList?.length ? (
            <>
              <Row className="TableRow CollaboratorsHeaderRow">
                <Typography
                  variant="body2"
                  className="CollaboratorsHeader"
                >
                  {t('modal.world_permissions.collaborators.column_name_label', {
                    number: `${collaboratorUsersList?.length}/10`,
                  })}
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
    </Box>
  );
});

export { WorldPermissionsCollaboratorsTab };
