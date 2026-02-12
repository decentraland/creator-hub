import React, { useCallback, useMemo, useState } from 'react';
import cx from 'classnames';
import AddIcon from '@mui/icons-material/AddRounded';
import LockIcon from '@mui/icons-material/Lock';
import PeopleIcon from '@mui/icons-material/People';
import PublicIcon from '@mui/icons-material/Public';
import { Box, MenuItem, type SelectChangeEvent, Typography } from 'decentraland-ui2';
import { t } from '/@/modules/store/translation/utils';
import { WorldPermissionType, WorldRoleType, type WorldPermissions } from '/@/lib/worlds';
import { useCommunities } from '/@/hooks/useCommunities';
import { Row } from '/@/components/Row';
import { Button } from '/@/components/Button';
import { Select } from '/@/components/Select';
import { ConfirmationPanel } from '/@/components/ConfirmationPanel';
import { WorldPermissionsAddUserForm, type CsvData } from '../../WorldPermissionsAddUserForm';
import { WorldPermissionsPasswordSection } from '../../WorldPermissionsPasswordSection';
import { WorldPermissionsPasswordForm } from '../../WorldPermissionsPasswordDialog';
import {
  WorldPermissionsLoadingItem,
  WorldPermissionsAccessItem,
} from '../../WorldPermissionsItem';
import './styles.css';

const CommunityAccessItem: React.FC<{
  communityId: string;
  name?: string;
  membersCount?: number;
  onRemove: () => void;
}> = React.memo(({ communityId, name, membersCount, onRemove }) => {
  return (
    <WorldPermissionsAccessItem
      walletAddress={communityId}
      icon={<PeopleIcon />}
      name={name ?? communityId}
      subtitle={
        membersCount !== undefined
          ? t('modal.world_permissions.access.community_members', { count: membersCount })
          : undefined
      }
      onRemoveAddress={onRemove}
    />
  );
});

type Props = {
  worldAccessPermissions: WorldPermissions['access'];
  worldOwnerAddress: string;
  collaboratorAddresses: string[];
  isLoadingNewUser: boolean;
  isLoadingPassword?: boolean;
  onChangeAccessType: (accessType: WorldPermissionType) => void;
  onAddAccessToAddress: (address: string) => void;
  onAddAccessToCommunity: (communityId: string) => void;
  onSubmitCsv: (data: CsvData) => void;
  onRemoveAccessFromAddress: (address: string) => void;
  onRemoveAccessFromCommunity: (communityId: string) => void;
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
    onAddAccessToCommunity,
    onSubmitCsv,
    onRemoveAccessFromAddress,
    onRemoveAccessFromCommunity,
    onClearAccessList,
    onSetAccessPassword,
  } = props;

  const [currentView, setCurrentView] = useState<
    | { type: 'default' }
    | { type: 'invite_form' }
    | { type: 'password_form' }
    | { type: 'clear_list_confirm' }
    | { type: 'change_access_type_confirm'; pendingAccessType: WorldPermissionType }
  >({ type: 'default' });

  const currentAccessType = worldAccessPermissions.type;
  const isPublic = currentAccessType === WorldPermissionType.Unrestricted;
  const isPasswordProtected = currentAccessType === WorldPermissionType.SharedSecret;
  const isInvitationOnly = currentAccessType === WorldPermissionType.AllowList;

  const apiWallets =
    worldAccessPermissions.type === WorldPermissionType.AllowList
      ? worldAccessPermissions.wallets
      : [];
  const apiCommunities =
    worldAccessPermissions.type === WorldPermissionType.AllowList
      ? (worldAccessPermissions.communities ?? [])
      : [];
  const ownerLower = worldOwnerAddress.toLowerCase();
  const collaboratorLowers = useMemo(
    () => collaboratorAddresses.map(c => c.toLowerCase()),
    [collaboratorAddresses],
  );
  const nonOwnerWallets = useMemo(
    () =>
      apiWallets.filter(
        w => w.toLowerCase() !== ownerLower && !collaboratorLowers.includes(w.toLowerCase()),
      ),
    [apiWallets, ownerLower, collaboratorLowers],
  );
  const hasAccessListEntries = nonOwnerWallets.length > 0 || apiCommunities.length > 0;

  const resetView = useCallback(() => setCurrentView({ type: 'default' }), []);

  const handleAccessTypeChange = useCallback(
    (event: SelectChangeEvent<WorldPermissionType>) => {
      const value = event.target.value as WorldPermissionType;
      if (isInvitationOnly && hasAccessListEntries && value !== WorldPermissionType.AllowList) {
        setCurrentView({ type: 'change_access_type_confirm', pendingAccessType: value });
        return;
      }
      if (value === WorldPermissionType.SharedSecret) {
        setCurrentView({ type: 'password_form' });
      } else {
        onChangeAccessType(value);
      }
    },
    [onChangeAccessType, isInvitationOnly, hasAccessListEntries],
  );

  const handleConfirmAccessTypeChange = useCallback(() => {
    if (currentView.type !== 'change_access_type_confirm') return;
    if (currentView.pendingAccessType === WorldPermissionType.SharedSecret) {
      setCurrentView({ type: 'password_form' });
    } else {
      onChangeAccessType(currentView.pendingAccessType);
      resetView();
    }
  }, [currentView, onChangeAccessType, resetView]);

  const handlePasswordSubmit = useCallback(
    (password: string) => {
      onSetAccessPassword(password);
      resetView();
    },
    [onSetAccessPassword, resetView],
  );

  const handleConfirmClearList = useCallback(() => {
    onClearAccessList();
    resetView();
  }, [onClearAccessList, resetView]);

  const handleAddAddress = useCallback(
    (address: string) => {
      onAddAccessToAddress(address);
      resetView();
    },
    [onAddAccessToAddress, resetView],
  );

  const handleAddCommunity = useCallback(
    (communityId: string) => {
      onAddAccessToCommunity(communityId);
      resetView();
    },
    [onAddAccessToCommunity, resetView],
  );

  const handleSubmitCsv = useCallback(
    (data: CsvData) => {
      onSubmitCsv(data);
      resetView();
    },
    [onSubmitCsv, resetView],
  );

  const wallets = useMemo(() => {
    const allWallets = apiWallets.some(w => w.toLowerCase() === ownerLower)
      ? apiWallets
      : [ownerLower, ...apiWallets];
    return [...allWallets].sort((a, b) => {
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
  }, [apiWallets, ownerLower, collaboratorLowers]);
  const { communities: resolvedCommunities, totalMembersCount } = useCommunities(apiCommunities);
  const totalInvited = wallets.length + totalMembersCount;

  if (currentView.type === 'change_access_type_confirm') {
    return (
      <Box className="WorldAccessTab CenteredContent">
        <ConfirmationPanel
          title={t('modal.world_permissions.access.change_access_type_title')}
          warning={t('modal.world_permissions.access.change_access_type_warning')}
          cancelLabel={t('modal.world_permissions.access.cancel')}
          confirmLabel={t('modal.world_permissions.access.continue')}
          onCancel={resetView}
          onConfirm={handleConfirmAccessTypeChange}
        />
      </Box>
    );
  }

  if (currentView.type === 'clear_list_confirm') {
    return (
      <Box className="WorldAccessTab CenteredContent">
        <ConfirmationPanel
          title={t('modal.world_permissions.access.clear_list_title')}
          warning={t('modal.world_permissions.access.clear_list_warning')}
          cancelLabel={t('modal.world_permissions.access.cancel')}
          confirmLabel={t('modal.world_permissions.access.confirm')}
          onCancel={resetView}
          onConfirm={handleConfirmClearList}
        />
      </Box>
    );
  }

  if (currentView.type === 'password_form') {
    return (
      <Box className="WorldAccessTab CenteredContent">
        <WorldPermissionsPasswordForm
          isChanging={isPasswordProtected}
          onCancel={resetView}
          onSubmit={handlePasswordSubmit}
        />
      </Box>
    );
  }

  if (currentView.type === 'invite_form') {
    return (
      <Box className="WorldAccessTab CenteredContent">
        <WorldPermissionsAddUserForm
          onSubmitAddress={handleAddAddress}
          onSubmitCommunity={handleAddCommunity}
          onSubmitCsv={handleSubmitCsv}
          onCancel={resetView}
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
                number: totalInvited,
              })}
            </Typography>
            <Row className="AccessListActions">
              <Typography
                className="ClearListLink"
                onClick={() => setCurrentView({ type: 'clear_list_confirm' })}
              >
                {t('modal.world_permissions.access.clear_list')}
              </Typography>
              <Button
                onClick={() => setCurrentView({ type: 'invite_form' })}
                color="primary"
                startIcon={<AddIcon />}
              >
                {t('modal.world_permissions.access.new_invite')}
              </Button>
            </Row>
          </Row>

          <Box className="AccessList">
            {wallets.map(wallet => {
              const lowerWallet = wallet.toLowerCase();
              const isOwner = lowerWallet === worldOwnerAddress.toLowerCase();
              const isCollaborator =
                !isOwner && collaboratorAddresses.some(c => c.toLowerCase() === lowerWallet);
              const role = isOwner
                ? WorldRoleType.OWNER
                : isCollaborator
                  ? WorldRoleType.COLLABORATOR
                  : undefined;
              return (
                <WorldPermissionsAccessItem
                  key={wallet}
                  walletAddress={lowerWallet}
                  role={role}
                  onRemoveAddress={() => onRemoveAccessFromAddress(wallet)}
                />
              );
            })}
            {apiCommunities.map(communityId => {
              const community = resolvedCommunities.get(communityId);
              return (
                <CommunityAccessItem
                  key={communityId}
                  communityId={communityId}
                  name={community?.name}
                  membersCount={community?.membersCount}
                  onRemove={() => onRemoveAccessFromCommunity(communityId)}
                />
              );
            })}
            {wallets.length === 0 && apiCommunities.length === 0 && !isLoadingNewUser && (
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
