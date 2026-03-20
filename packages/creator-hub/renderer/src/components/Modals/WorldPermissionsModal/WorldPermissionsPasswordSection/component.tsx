import React from 'react';
import { Box } from 'decentraland-ui2';
import { t } from '/@/modules/store/translation/utils';
import { Button } from '/@/components/Button';
import './styles.css';

type Props = {
  hasPassword: boolean;
  isLoading: boolean;
  onChangePasswordClick: () => void;
};

export const WorldPermissionsPasswordSection: React.FC<Props> = React.memo(
  ({ hasPassword, isLoading, onChangePasswordClick }) => {
    return (
      <Box className="PasswordSection">
        <Button
          onClick={onChangePasswordClick}
          color="primary"
          disabled={isLoading}
        >
          {hasPassword
            ? t('modal.world_permissions.password.change_password')
            : t('modal.world_permissions.password.create_new_password')}
        </Button>
      </Box>
    );
  },
);
