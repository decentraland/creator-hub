import React, { useCallback, useState } from 'react';
import { Box, Typography } from 'decentraland-ui2';
import { t } from '/@/modules/store/translation/utils';
import { Row } from '/@/components/Row';
import { Button } from '/@/components/Button';
import { WorldPermissionsPasswordDialog } from '../WorldPermissionsPasswordDialog';
import './styles.css';

type Props = {
  hasPassword: boolean;
  isLoading: boolean;
  onSetPassword: (password: string) => void;
};

export const WorldPermissionsPasswordSection: React.FC<Props> = React.memo(
  ({ hasPassword, isLoading, onSetPassword }) => {
    const [dialogOpen, setDialogOpen] = useState(false);

    const handleOpenDialog = useCallback(() => {
      setDialogOpen(true);
    }, []);

    const handleCloseDialog = useCallback(() => {
      setDialogOpen(false);
    }, []);

    const handleSubmitPassword = useCallback(
      (newPassword: string) => {
        onSetPassword(newPassword);
        setDialogOpen(false);
      },
      [onSetPassword],
    );

    return (
      <Box className="PasswordSection">
        <Box className="PasswordEmptyState">
          <Typography
            variant="body2"
            className="PasswordEmptyText"
          >
            {hasPassword
              ? t('modal.world_permissions.password.has_password')
              : t('modal.world_permissions.password.empty_state')}
          </Typography>
          <Row className="PasswordActions">
            <Button
              onClick={handleOpenDialog}
              color="primary"
              disabled={isLoading}
            >
              {hasPassword
                ? t('modal.world_permissions.password.change_password')
                : t('modal.world_permissions.password.create_new_password')}
            </Button>
          </Row>
        </Box>

        <WorldPermissionsPasswordDialog
          open={dialogOpen}
          isChanging={hasPassword}
          onClose={handleCloseDialog}
          onSubmit={handleSubmitPassword}
        />
      </Box>
    );
  },
);
