import React, { useCallback, useState } from 'react';
import { Box } from 'decentraland-ui2';
import { t } from '/@/modules/store/translation/utils';
import { Button } from '/@/components/Button';
import { WorldPermissionsPasswordForm } from '../WorldPermissionsPasswordDialog';
import './styles.css';

type Props = {
  hasPassword: boolean;
  isLoading: boolean;
  onSetPassword: (password: string) => void;
};

export const WorldPermissionsPasswordSection: React.FC<Props> = React.memo(
  ({ hasPassword, isLoading, onSetPassword }) => {
    const [showForm, setShowForm] = useState(false);

    const handleShowForm = useCallback(() => {
      setShowForm(true);
    }, []);

    const handleHideForm = useCallback(() => {
      setShowForm(false);
    }, []);

    const handleSubmitPassword = useCallback(
      (newPassword: string) => {
        onSetPassword(newPassword);
        setShowForm(false);
      },
      [onSetPassword],
    );

    if (showForm) {
      return (
        <WorldPermissionsPasswordForm
          isChanging={hasPassword}
          onCancel={handleHideForm}
          onSubmit={handleSubmitPassword}
        />
      );
    }

    return (
      <Box className="PasswordSection">
        <Button
          onClick={handleShowForm}
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
