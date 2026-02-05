import React, { useCallback, useState } from 'react';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
} from 'decentraland-ui2';
import { t } from '/@/modules/store/translation/utils';
import { Row } from '/@/components/Row';
import { Button } from '/@/components/Button';
import './styles.css';

const MIN_PASSWORD_LENGTH = 8;

type Props = {
  open: boolean;
  isChanging: boolean;
  onClose: () => void;
  onSubmit: (password: string) => void;
};

const WorldPermissionsPasswordDialogComponent: React.FC<Props> = React.memo(
  ({ open, isChanging, onClose, onSubmit }) => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handlePasswordChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
      setPassword(event.target.value);
      setError(null);
    }, []);

    const handleConfirmPasswordChange = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        setConfirmPassword(event.target.value);
        setError(null);
      },
      [],
    );

    const handleTogglePasswordVisibility = useCallback(() => {
      setShowPassword(prev => !prev);
    }, []);

    const handleToggleConfirmPasswordVisibility = useCallback(() => {
      setShowConfirmPassword(prev => !prev);
    }, []);

    const handleSubmit = useCallback(() => {
      if (!password) {
        setError(t('modal.world_permissions.password.error.empty'));
        return;
      }
      if (password.length < MIN_PASSWORD_LENGTH) {
        setError(
          t('modal.world_permissions.password.error.too_short', { min: MIN_PASSWORD_LENGTH }),
        );
        return;
      }
      if (password !== confirmPassword) {
        setError(t('modal.world_permissions.password.error.mismatch'));
        return;
      }
      onSubmit(password);
      // Reset state after submit
      setPassword('');
      setConfirmPassword('');
      setError(null);
    }, [password, confirmPassword, onSubmit]);

    const handleClose = useCallback(() => {
      // Reset state on close
      setPassword('');
      setConfirmPassword('');
      setError(null);
      setShowPassword(false);
      setShowConfirmPassword(false);
      onClose();
    }, [onClose]);

    const isValid = password.length >= MIN_PASSWORD_LENGTH && password === confirmPassword;

    return (
      <Dialog
        open={open}
        onClose={handleClose}
        className="WorldPermissionsDialog"
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle className="DialogTitle">
          {isChanging
            ? t('modal.world_permissions.password.dialog.change_title')
            : t('modal.world_permissions.password.dialog.create_title')}
        </DialogTitle>
        <DialogContent className="DialogContent">
          <Box className="DialogField">
            <Typography
              variant="body2"
              className="DialogLabel"
            >
              {t('modal.world_permissions.password.dialog.type_password')}
            </Typography>
            <TextField
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={handlePasswordChange}
              variant="outlined"
              size="small"
              fullWidth
              autoFocus
              InputProps={{
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
          </Box>

          <Box className="DialogField">
            <Typography
              variant="body2"
              className="DialogLabel"
            >
              {t('modal.world_permissions.password.dialog.repeat_password')}
            </Typography>
            <TextField
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={handleConfirmPasswordChange}
              variant="outlined"
              size="small"
              fullWidth
              error={!!error}
              helperText={error}
              InputProps={{
                endAdornment: (
                  <IconButton
                    onClick={handleToggleConfirmPasswordVisibility}
                    edge="end"
                    size="small"
                  >
                    {showConfirmPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                ),
              }}
            />
          </Box>

          <Row className="DialogActions">
            <Button
              onClick={handleClose}
              color="secondary"
            >
              {t('modal.cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              color="primary"
              disabled={!isValid}
            >
              {t('modal.confirm')}
            </Button>
          </Row>
        </DialogContent>
      </Dialog>
    );
  },
);

WorldPermissionsPasswordDialogComponent.displayName = 'WorldPermissionsPasswordDialog';

export const WorldPermissionsPasswordDialog = WorldPermissionsPasswordDialogComponent;
