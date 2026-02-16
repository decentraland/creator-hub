import React, { useCallback, useMemo } from 'react';
import cx from 'classnames';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckIcon from '@mui/icons-material/Check';
import { Box, Chip, MenuItem } from 'decentraland-ui2';
import { Row } from '/@/components/Row';
import { t } from '/@/modules/store/translation/utils';
import { Dropdown } from '/@/components/Dropdown';
import { Select } from '/@/components/Select';
import { WorldRoleType } from '/@/lib/worlds';
import { WorldPermissionsAvatarWithInfo } from '../WorldPermissionsAvatarWithInfo';
import type { AccessItemProps, BaseProps, CollaboratorsItemProps, DeploymentOption } from './types';
import { DeploymentOptionValue } from './types';
import './styles.css';

export const WorldPermissionsItem: React.FC<BaseProps> = React.memo(
  ({ walletAddress, icon, name, subtitle, tag, menuOptions, className, children = null }) => {
    return (
      <Box className={cx('WorldPermissionsItem', className)}>
        <Row className="WorldPermissionsItemInfo">
          <WorldPermissionsAvatarWithInfo
            value={walletAddress}
            icon={icon}
            name={name}
            subtitle={subtitle}
          />
          {tag}
        </Row>
        <Box>{children}</Box>
        {menuOptions && <Dropdown options={menuOptions} />}
      </Box>
    );
  },
);

export const WorldPermissionsLoadingItem: React.FC = React.memo(() => {
  return (
    <Row className="WorldPermissionsItem">
      <WorldPermissionsAvatarWithInfo
        isLoading
        value=""
      />
    </Row>
  );
});

export const WorldPermissionsAccessItem: React.FC<AccessItemProps> = React.memo(
  ({ walletAddress, icon, name, subtitle, role, onRemoveAddress }) => {
    // owners and collaborators cannot be removed from the access list, so we hide the menu for them.
    const menuOptions = role
      ? undefined
      : [
          {
            text: t('modal.world_permissions.access.actions.remove'),
            icon: <DeleteIcon />,
            handler: onRemoveAddress,
          },
        ];

    const roleLabel =
      role === WorldRoleType.OWNER
        ? t('manage.cards.roles.owner')
        : role === WorldRoleType.COLLABORATOR
          ? t('manage.cards.roles.collaborator')
          : undefined;

    return (
      <WorldPermissionsItem
        walletAddress={walletAddress}
        icon={icon}
        name={name}
        subtitle={subtitle}
        menuOptions={menuOptions}
        tag={
          roleLabel ? (
            <Chip
              className="RoleBadge"
              label={roleLabel}
              size="small"
              variant="filled"
            />
          ) : undefined
        }
      />
    );
  },
);

export const WorldPermissionsCollaboratorsItem: React.FC<CollaboratorsItemProps> = React.memo(
  props => {
    const {
      walletAddress,
      role,
      hasDeploymentPermission,
      hasStreamingPermission,
      allowedParcelsCount = 0,
      onGrantWorldWideDeploymentPermission,
      onGrantParcelsDeploymentPermission,
      onRemoveCollaborator,
    } = props;

    const menuOptions =
      role !== WorldRoleType.OWNER
        ? [
            {
              text: t('modal.world_permissions.access.actions.remove'),
              icon: <DeleteIcon />,
              handler: onRemoveCollaborator,
            },
          ]
        : undefined;

    const deploymentOptionValue = useMemo(() => {
      if (!hasDeploymentPermission) return DeploymentOptionValue.None;
      if (allowedParcelsCount > 0) return DeploymentOptionValue.Parcels;
      return DeploymentOptionValue.WorldWide;
    }, [hasDeploymentPermission, allowedParcelsCount]);

    const deploymentOptions: DeploymentOption[] = useMemo(
      () =>
        [
          {
            value: DeploymentOptionValue.WorldWide,
            label: t('modal.world_permissions.collaborators.deployment.world_wide'),
          },
          {
            value: DeploymentOptionValue.Parcels,
            label: t('modal.world_permissions.collaborators.deployment.parcels'),
          },
          {
            value: DeploymentOptionValue.None,
            label: t('modal.world_permissions.collaborators.deployment.none'),
            disabled: true,
            hidden: !(!hasDeploymentPermission && hasStreamingPermission),
          },
        ].filter(option => !option.hidden),
      [hasDeploymentPermission, hasStreamingPermission],
    );

    const handleChangeDeploymentOption = useCallback(
      (value: DeploymentOptionValue) => {
        switch (value) {
          case DeploymentOptionValue.WorldWide:
            return onGrantWorldWideDeploymentPermission();
          case DeploymentOptionValue.Parcels:
            return onGrantParcelsDeploymentPermission();
          case DeploymentOptionValue.None:
            return onRemoveCollaborator();
          default:
            return;
        }
      },
      [
        onGrantWorldWideDeploymentPermission,
        onGrantParcelsDeploymentPermission,
        onRemoveCollaborator,
      ],
    );

    const renderValue = useCallback(
      (value: DeploymentOptionValue) => {
        switch (value) {
          case DeploymentOptionValue.None:
            return t('modal.world_permissions.collaborators.deployment.none');
          case DeploymentOptionValue.Parcels:
            return t('modal.world_permissions.collaborators.parcels_count', {
              count: allowedParcelsCount,
            });
          case DeploymentOptionValue.WorldWide:
            return t('modal.world_permissions.collaborators.deployment.world_wide');
          default:
            return '';
        }
      },
      [allowedParcelsCount],
    );

    return (
      <WorldPermissionsItem
        walletAddress={walletAddress}
        menuOptions={menuOptions}
        className="WorldCollaboratorItem"
        tag={
          <Chip
            className="RoleBadge"
            label={
              role === WorldRoleType.OWNER
                ? t('manage.cards.roles.owner')
                : t('manage.cards.roles.collaborator')
            }
            size="small"
            variant="filled"
          />
        }
      >
        {role !== WorldRoleType.OWNER && (
          <Select
            className="DeploymentOptionSelect"
            value={deploymentOptionValue}
            renderValue={renderValue}
          >
            {deploymentOptions.map(option => (
              <MenuItem
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className="DeploymentOptionMenuItem"
                onClick={() => handleChangeDeploymentOption(option.value)}
              >
                {option.label}
                {option.value === deploymentOptionValue && <CheckIcon />}
              </MenuItem>
            ))}
          </Select>
        )}
      </WorldPermissionsItem>
    );
  },
);
