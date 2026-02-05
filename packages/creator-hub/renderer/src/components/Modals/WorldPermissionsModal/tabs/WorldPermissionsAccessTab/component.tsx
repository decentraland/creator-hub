import React, { useCallback, useState } from 'react';
import cx from 'classnames';
import AddIcon from '@mui/icons-material/AddRounded';
import { Box, MenuItem, type SelectChangeEvent, Typography } from 'decentraland-ui2';
import { t } from '/@/modules/store/translation/utils';
import { WorldPermissionType, type WorldPermissions } from '/@/lib/worlds';
import { Row } from '/@/components/Row';
import { Button } from '/@/components/Button';
import { Select } from '/@/components/Select';
import { WorldPermissionsAddUserForm } from '../../WorldPermissionsAddUserForm';
import { WorldPermissionsPasswordSection } from '../../WorldPermissionsPasswordSection';
import { WorldPermissionsPasswordDialog } from '../../WorldPermissionsPasswordDialog';
import {
  WorldPermissionsLoadingItem,
  WorldPermissionsAccessItem,
} from '../../WorldPermissionsItem';
import './styles.css';

type Props = {
  worldAccessPermissions: WorldPermissions['access'];
  isLoadingNewUser: boolean;
  isLoadingPassword?: boolean;
  onChangeAccessType: (accessType: WorldPermissionType) => void;
  onAddAccessToAddress: (address: string) => void;
  onRemoveAccessFromAddress: (address: string) => void;
  onSetAccessPassword: (password: string) => void;
};

const ACCESS_TYPE_OPTIONS: Array<{ label: string; value: WorldPermissionType }> = [
  {
    label: t('modal.world_permissions.access.type.public'),
    value: WorldPermissionType.Unrestricted,
  },
  {
    label: t('modal.world_permissions.access.type.invitation_only'),
    value: WorldPermissionType.AllowList,
  },
  {
    label: t('modal.world_permissions.access.type.password_protected'),
    value: WorldPermissionType.SharedSecret,
  },
];

const getAccessTypeDescription = (accessType: WorldPermissionType): string => {
  switch (accessType) {
    case WorldPermissionType.Unrestricted:
      return t('modal.world_permissions.access.type.public_description');
    case WorldPermissionType.AllowList:
      return t('modal.world_permissions.access.type.invitation_only_description');
    case WorldPermissionType.SharedSecret:
      return t('modal.world_permissions.access.type.password_protected_description');
    default:
      return '';
  }
};

const WorldPermissionsAccessTab: React.FC<Props> = React.memo(props => {
  const {
    worldAccessPermissions,
    isLoadingNewUser,
    isLoadingPassword = false,
    onChangeAccessType,
    onAddAccessToAddress,
    onRemoveAccessFromAddress,
    onSetAccessPassword,
  } = props;

  const [showInviteForm, setShowInviteForm] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  const currentAccessType = worldAccessPermissions.type;
  const isPublic = currentAccessType === WorldPermissionType.Unrestricted;
  const isPasswordProtected = currentAccessType === WorldPermissionType.SharedSecret;
  const isInvitationOnly = currentAccessType === WorldPermissionType.AllowList;

  const handleAccessTypeChange = useCallback(
    (event: SelectChangeEvent<WorldPermissionType>) => {
      const value = event.target.value as WorldPermissionType;
      if (value === WorldPermissionType.SharedSecret) {
        setShowPasswordDialog(true);
      } else {
        onChangeAccessType(value);
      }
    },
    [onChangeAccessType],
  );

  const handlePasswordSubmit = useCallback(
    (password: string) => {
      onSetAccessPassword(password);
      setShowPasswordDialog(false);
    },
    [onSetAccessPassword],
  );

  const handlePasswordDialogClose = useCallback(() => {
    setShowPasswordDialog(false);
  }, []);

  const handleShowInviteForm = useCallback(() => {
    setShowInviteForm(true);
  }, []);

  const handleHideInviteForm = useCallback(() => {
    setShowInviteForm(false);
  }, []);

  const handleAddAddress = useCallback(
    (address: string) => {
      onAddAccessToAddress(address);
      setShowInviteForm(false);
    },
    [onAddAccessToAddress],
  );

  const wallets =
    worldAccessPermissions.type === WorldPermissionType.AllowList
      ? worldAccessPermissions.wallets
      : [];
  const walletsCount = wallets.length;

  return (
    <Box className={cx('WorldAccessTab', { RestrictedAccess: !isPublic })}>
      <Typography variant="h6">{t('modal.world_permissions.access.title')}</Typography>

      <Row className="AccessTypeRow">
        <Select
          className="AccessTypeSelect"
          value={currentAccessType}
          onChange={handleAccessTypeChange}
        >
          {ACCESS_TYPE_OPTIONS.map(option => (
            <MenuItem
              key={option.value}
              value={option.value}
              className="AccessTypeMenuItem"
            >
              {option.label}
            </MenuItem>
          ))}
        </Select>
        <Typography
          variant="body2"
          className="AccessTypeDescription"
        >
          {getAccessTypeDescription(currentAccessType)}
        </Typography>
      </Row>

      {isPasswordProtected && (
        <WorldPermissionsPasswordSection
          hasPassword={isPasswordProtected}
          isLoading={isLoadingPassword}
          onSetPassword={onSetAccessPassword}
        />
      )}

      <WorldPermissionsPasswordDialog
        open={showPasswordDialog}
        isChanging={false}
        onClose={handlePasswordDialogClose}
        onSubmit={handlePasswordSubmit}
      />

      {isInvitationOnly && worldAccessPermissions.type === WorldPermissionType.AllowList && (
        <Box className="AccessFormContainer">
          <Row className="AccessListHeader">
            <Typography
              variant="body2"
              className="ApprovedAddressesCount"
            >
              {t('modal.world_permissions.access.approved_addresses', {
                number: `${walletsCount}/100`,
              })}
            </Typography>
            {!showInviteForm && (
              <Button
                onClick={handleShowInviteForm}
                color="primary"
                startIcon={<AddIcon />}
              >
                {t('modal.world_permissions.access.new_invite')}
              </Button>
            )}
          </Row>

          {showInviteForm && (
            <Box className="InviteFormContainer">
              <WorldPermissionsAddUserForm
                addButtonLabel={t('modal.world_permissions.access.confirm')}
                cancelButtonLabel={t('modal.world_permissions.access.cancel')}
                onSubmitAddress={handleAddAddress}
                onCancel={handleHideInviteForm}
              />
            </Box>
          )}

          <Box className="AccessList">
            {walletsCount > 0
              ? wallets.map(wallet => (
                  <WorldPermissionsAccessItem
                    key={wallet}
                    walletAddress={wallet.toLowerCase()}
                    onRemoveAddress={() => onRemoveAccessFromAddress(wallet)}
                  />
                ))
              : !isLoadingNewUser && (
                  <Typography className="EmptyList">
                    {t('modal.world_permissions.access.empty_list')}
                  </Typography>
                )}
            {isLoadingNewUser && <WorldPermissionsLoadingItem />}
          </Box>
        </Box>
      )}
    </Box>
  );
});

export { WorldPermissionsAccessTab };
