import React, { useCallback, useState } from 'react';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { Box, IconButton, TextField, Typography } from 'decentraland-ui2';
import { t } from '/@/modules/store/translation/utils';
import { Row } from '/@/components/Row';
import { Button } from '/@/components/Button';
import { WorldPermissionsPasswordDialog } from '../WorldPermissionsPasswordDialog';
import './styles.css';

type Props = {
  password?: string;
  isLoading: boolean;
  onCreatePassword: (password: string) => void;
  onChangePassword: (password: string) => void;
};

export const WorldPermissionsPasswordSection: React.FC<Props> = React.memo(
  ({ password, isLoading, onCreatePassword, onChangePassword }) => {
    const [showPassword, setShowPassword] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    const handleTogglePasswordVisibility = useCallback(() => {
      setShowPassword(prev => !prev);
    }, []);

    const handleCopyToClipboard = useCallback(async () => {
      if (password) {
        await navigator.clipboard.writeText(password);
      }
    }, [password]);

    const handleOpenCreateDialog = useCallback(() => {
      setIsChangingPassword(false);
      setDialogOpen(true);
    }, []);

    const handleOpenChangeDialog = useCallback(() => {
      setIsChangingPassword(true);
      setDialogOpen(true);
    }, []);

    const handleCloseDialog = useCallback(() => {
      setDialogOpen(false);
    }, []);

    const handleSubmitPassword = useCallback(
      (newPassword: string) => {
        if (isChangingPassword) {
          onChangePassword(newPassword);
        } else {
          onCreatePassword(newPassword);
        }
        setDialogOpen(false);
      },
      [isChangingPassword, onCreatePassword, onChangePassword],
    );

    const hasPassword = !!password;

    return (
      <Box className="PasswordSection">
        {hasPassword ? (
          <>
            <Typography
              variant="body2"
              className="PasswordLabel"
            >
              {t('modal.world_permissions.password.current_password')}
            </Typography>
            <Row className="PasswordFieldRow">
              <TextField
                type={showPassword ? 'text' : 'password'}
                value={password}
                variant="outlined"
                size="small"
                className="PasswordField"
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <IconButton
                      onClick={handleTogglePasswordVisibility}
                      edge="end"
                      size="small"
                    >
                      {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  ),
                }}
              />
            </Row>
            <Row className="PasswordActions">
              <Button
                onClick={handleCopyToClipboard}
                color="secondary"
              >
                {t('modal.world_permissions.password.copy_to_clipboard')}
              </Button>
              <Button
                onClick={handleOpenChangeDialog}
                color="primary"
                disabled={isLoading}
              >
                {t('modal.world_permissions.password.change_password')}
              </Button>
            </Row>
          </>
        ) : (
          <Box className="PasswordEmptyState">
            <Typography
              variant="body2"
              className="PasswordEmptyText"
            >
              {t('modal.world_permissions.password.empty_state')}
            </Typography>
            <Button
              onClick={handleOpenCreateDialog}
              color="primary"
              disabled={isLoading}
            >
              {t('modal.world_permissions.password.create_new_password')}
            </Button>
          </Box>
        )}

        <WorldPermissionsPasswordDialog
          open={dialogOpen}
          isChanging={isChangingPassword}
          onClose={handleCloseDialog}
          onSubmit={handleSubmitPassword}
        />
      </Box>
    );
  },
);
