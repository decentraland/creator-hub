import React, { useCallback, useState } from 'react';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { Box, IconButton, TextField, Typography } from 'decentraland-ui2';
import { t } from '/@/modules/store/translation/utils';
import { Row } from '/@/components/Row';
import { Button } from '/@/components/Button';
import { Info } from '../../DeploymentHistory/styled';
import './styles.css';

const MIN_PASSWORD_LENGTH = 8;

type Props = {
  isChanging: boolean;
  onCancel: () => void;
  onSubmit: (password: string) => void;
};

const WorldPermissionsPasswordFormComponent: React.FC<Props> = React.memo(
  ({ isChanging, onCancel, onSubmit }) => {
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
    }, [password, confirmPassword, onSubmit]);

    const handleCancel = useCallback(() => {
      onCancel();
    }, [onCancel]);

    const isValid = password.length >= MIN_PASSWORD_LENGTH && password === confirmPassword;

    return (
      <Box className="PasswordForm">
        <Typography
          variant="h6"
          className="PasswordFormTitle"
        >
          {isChanging
            ? t('modal.world_permissions.password.dialog.change_title')
            : t('modal.world_permissions.password.dialog.create_title')}
        </Typography>

        <Box className="PasswordFormField">
          <Typography
            variant="body2"
            className="PasswordFormLabel"
          >
            {t('modal.world_permissions.password.dialog.type_password')}
          </Typography>
          <TextField
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={handlePasswordChange}
            variant="outlined"
            size="medium"
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

        <Box className="PasswordFormField">
          <Typography
            variant="body2"
            className="PasswordFormLabel"
          >
            {t('modal.world_permissions.password.dialog.repeat_password')}
          </Typography>
          <TextField
            type={showConfirmPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={handleConfirmPasswordChange}
            variant="outlined"
            size="medium"
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

        <Info className="PasswordFormInfo">
          <InfoOutlinedIcon fontSize="small" />
          <Typography variant="body2">
            {t('modal.world_permissions.password.dialog.info')}
          </Typography>
        </Info>

        <Row className="PasswordFormActions">
          <Button
            onClick={handleCancel}
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
      </Box>
    );
  },
);

WorldPermissionsPasswordFormComponent.displayName = 'WorldPermissionsPasswordForm';

export const WorldPermissionsPasswordForm = WorldPermissionsPasswordFormComponent;
