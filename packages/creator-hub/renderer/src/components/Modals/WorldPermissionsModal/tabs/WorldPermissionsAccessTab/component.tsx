import React from 'react';
import cx from 'classnames';
import WarningIcon from '@mui/icons-material/WarningAmber';
import { Box, Switch, Typography } from 'decentraland-ui2';
import { t, T } from '/@/modules/store/translation/utils';
import type { AllowListPermissionSetting, UnrestrictedPermissionSetting } from '/@/lib/worlds';
import { WorldPermissionType } from '/@/lib/worlds';
import { Row } from '/@/components/Row';
import { WorldPermissionsAddUserForm } from '../../WorldPermissionsAddUserForm';
import {
  WorldPermissionsLoadingItem,
  WorldPermissionsAccessItem,
} from '../../WorldPermissionsItem';
import './styles.css';

type Props = {
  isPublic: boolean;
  worldAccessPermissions: AllowListPermissionSetting | UnrestrictedPermissionSetting;
  isLoadingNewUser: boolean;
  onToggleAccessPermission: (newValue: boolean) => void;
  onAddAccessToAddress: (address: string) => void;
  onRemoveAccessFromAddress: (address: string) => void;
};

const WorldPermissionsAccessTab: React.FC<Props> = React.memo(props => {
  const {
    isPublic,
    worldAccessPermissions,
    isLoadingNewUser,
    onToggleAccessPermission,
    onAddAccessToAddress,
    onRemoveAccessFromAddress,
  } = props;
  return (
    <Box className={cx('WorldAccessTab', { RestrictedAccess: !isPublic })}>
      <Typography variant="h6">
        <T
          id="modal.world_permissions.access.description"
          values={{ span: (chunks: React.ReactNode) => <span>{chunks}</span> }}
        />
      </Typography>
      <Typography variant="body2">
        <T
          id="modal.world_permissions.access.subtitle"
          values={{ span: (chunks: React.ReactNode) => <span>{chunks}</span> }}
        />
      </Typography>

      {!isPublic && (
        <Box className="WarningContainer">
          <WarningIcon />
          <Box>
            <Typography className="WarningTitle">
              {t('modal.world_permissions.access.warning.title')}
            </Typography>
            <Typography variant="body2">
              {t('modal.world_permissions.access.warning.description')}
            </Typography>
          </Box>
        </Box>
      )}

      <Row>
        <Box className="AccessSwitchContainer">
          <Typography>{t('modal.world_permissions.access.private')}</Typography>
          <Switch
            checked={isPublic}
            onChange={(_event, checked) => onToggleAccessPermission(checked)}
          />
          <Typography>{t('modal.world_permissions.access.public')}</Typography>
        </Box>
        {worldAccessPermissions.type === WorldPermissionType.AllowList && (
          <Typography color="var(--dcl-silver)">
            {t('modal.world_permissions.access.approved_addresses', {
              number: `${worldAccessPermissions.wallets?.length || 0}/100`,
            })}
          </Typography>
        )}
      </Row>

      {!isPublic && worldAccessPermissions.type === WorldPermissionType.AllowList && (
        <Box className="AccessFormContainer">
          <WorldPermissionsAddUserForm
            addButtonLabel={t('modal.world_permissions.access.add_address')}
            onSubmitAddress={onAddAccessToAddress}
          />
          <Box className="AccessList">
            {worldAccessPermissions.wallets?.length
              ? worldAccessPermissions.wallets.map(wallet => {
                  return (
                    <WorldPermissionsAccessItem
                      key={wallet}
                      walletAddress={wallet.toLowerCase()}
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
