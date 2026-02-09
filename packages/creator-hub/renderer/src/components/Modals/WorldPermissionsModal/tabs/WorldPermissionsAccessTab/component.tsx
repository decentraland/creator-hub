import React, { useCallback, useState } from 'react';
import cx from 'classnames';
import AddIcon from '@mui/icons-material/AddRounded';
import LockIcon from '@mui/icons-material/Lock';
import PeopleIcon from '@mui/icons-material/People';
import PublicIcon from '@mui/icons-material/Public';
import { Box, MenuItem, type SelectChangeEvent, Typography } from 'decentraland-ui2';
import { t } from '/@/modules/store/translation/utils';
import { WorldPermissionType, type WorldPermissions } from '/@/lib/worlds';
import { Row } from '/@/components/Row';
import { Button } from '/@/components/Button';
import { Select } from '/@/components/Select';
import { WorldPermissionsAddUserForm } from '../../WorldPermissionsAddUserForm';
import { WorldPermissionsPasswordSection } from '../../WorldPermissionsPasswordSection';
import { WorldPermissionsPasswordForm } from '../../WorldPermissionsPasswordDialog';
import {
  WorldPermissionsLoadingItem,
  WorldPermissionsAccessItem,
} from '../../WorldPermissionsItem';
import './styles.css';

type Props = {
  worldAccessPermissions: WorldPermissions['access'];
  worldOwnerAddress: string;
  collaboratorAddresses: string[];
  isLoadingNewUser: boolean;
  isLoadingPassword?: boolean;
  onChangeAccessType: (accessType: WorldPermissionType) => void;
  onAddAccessToAddress: (address: string) => void;
  onRemoveAccessFromAddress: (address: string) => void;
  onClearAccessList: () => void;
  onSetAccessPassword: (password: string) => void;
};

const ACCESS_TYPE_OPTIONS: Array<{
  label: string;
  value: WorldPermissionType;
  icon: React.ReactNode;
}> = [
  {
    label: t('modal.world_permissions.access.type.public'),
    value: WorldPermissionType.Unrestricted,
    icon: <PublicIcon fontSize="small" />,
  },
  {
    label: t('modal.world_permissions.access.type.invitation_only'),
    value: WorldPermissionType.AllowList,
    icon: <PeopleIcon fontSize="small" />,
  },
  {
    label: t('modal.world_permissions.access.type.password_protected'),
    value: WorldPermissionType.SharedSecret,
    icon: <LockIcon fontSize="small" />,
  },
];

const renderAccessTypeOption = (value: WorldPermissionType) => {
  const option = ACCESS_TYPE_OPTIONS.find(o => o.value === value);
  if (!option) return '';
  return (
    <Box className="AccessTypeValue">
      {option.icon}
      {option.label}
    </Box>
  );
};

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
    worldOwnerAddress,
    collaboratorAddresses,
    isLoadingNewUser,
    isLoadingPassword = false,
    onChangeAccessType,
    onAddAccessToAddress,
    onRemoveAccessFromAddress,
    onClearAccessList,
    onSetAccessPassword,
  } = props;

  const [showInviteForm, setShowInviteForm] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const currentAccessType = worldAccessPermissions.type;
  const isPublic = currentAccessType === WorldPermissionType.Unrestricted;
  const isPasswordProtected = currentAccessType === WorldPermissionType.SharedSecret;
  const isInvitationOnly = currentAccessType === WorldPermissionType.AllowList;

  const handleAccessTypeChange = useCallback(
    (event: SelectChangeEvent<WorldPermissionType>) => {
      const value = event.target.value as WorldPermissionType;
      if (value === WorldPermissionType.SharedSecret) {
        setShowPasswordForm(true);
      } else {
        setShowPasswordForm(false);
        onChangeAccessType(value);
      }
    },
    [onChangeAccessType],
  );

  const handlePasswordSubmit = useCallback(
    (password: string) => {
      onSetAccessPassword(password);
      setShowPasswordForm(false);
    },
    [onSetAccessPassword],
  );

  const handlePasswordFormClose = useCallback(() => {
    setShowPasswordForm(false);
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

  const apiWallets =
    worldAccessPermissions.type === WorldPermissionType.AllowList
      ? worldAccessPermissions.wallets
      : [];
  const ownerLower = worldOwnerAddress.toLowerCase();
  const collaboratorLowers = collaboratorAddresses.map(c => c.toLowerCase());
  const allWallets = apiWallets.some(w => w.toLowerCase() === ownerLower)
    ? apiWallets
    : [ownerLower, ...apiWallets];
  const wallets = [...allWallets].sort((a, b) => {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    const aIsOwner = aLower === ownerLower;
    const bIsOwner = bLower === ownerLower;
    if (aIsOwner !== bIsOwner) return aIsOwner ? -1 : 1;
    const aIsCollab = collaboratorLowers.includes(aLower);
    const bIsCollab = collaboratorLowers.includes(bLower);
    if (aIsCollab !== bIsCollab) return aIsCollab ? -1 : 1;
    return 0;
  });
  const walletsCount = wallets.length;

  if (showPasswordForm) {
    return (
      <Box className="WorldAccessTab CenteredContent">
        <WorldPermissionsPasswordForm
          isChanging={isPasswordProtected}
          onCancel={handlePasswordFormClose}
          onSubmit={handlePasswordSubmit}
        />
      </Box>
    );
  }

  if (showInviteForm) {
    return (
      <Box className="WorldAccessTab CenteredContent">
        <WorldPermissionsAddUserForm
          onSubmitAddress={handleAddAddress}
          onCancel={handleHideInviteForm}
        />
      </Box>
    );
  }

  return (
    <Box className={cx('WorldAccessTab', { RestrictedAccess: !isPublic })}>
      <Typography variant="h6">{t('modal.world_permissions.access.title')}</Typography>

      <Row className="AccessTypeRow">
        <Select
          className="AccessTypeSelect"
          value={currentAccessType}
          onChange={handleAccessTypeChange}
          renderValue={renderAccessTypeOption}
        >
          {ACCESS_TYPE_OPTIONS.map(option => (
            <MenuItem
              key={option.value}
              value={option.value}
              className="AccessTypeMenuItem"
            >
              {renderAccessTypeOption(option.value)}
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
            <Row className="AccessListActions">
              <Typography
                className="ClearListLink"
                onClick={onClearAccessList}
              >
                {t('modal.world_permissions.access.clear_list')}
              </Typography>
              <Button
                onClick={handleShowInviteForm}
                color="primary"
                startIcon={<AddIcon />}
              >
                {t('modal.world_permissions.access.new_invite')}
              </Button>
            </Row>
          </Row>

          <Box className="AccessList">
            {walletsCount > 0
              ? wallets.map(wallet => {
                  const lowerWallet = wallet.toLowerCase();
                  const isOwner = lowerWallet === worldOwnerAddress.toLowerCase();
                  const isCollaborator =
                    !isOwner && collaboratorAddresses.some(c => c.toLowerCase() === lowerWallet);
                  const role = isOwner ? 'owner' : isCollaborator ? 'collaborator' : undefined;
                  return (
                    <WorldPermissionsAccessItem
                      key={wallet}
                      walletAddress={lowerWallet}
                      role={role}
                      onRemoveAddress={() => onRemoveAccessFromAddress(wallet)}
                    />
                  );
                })
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
