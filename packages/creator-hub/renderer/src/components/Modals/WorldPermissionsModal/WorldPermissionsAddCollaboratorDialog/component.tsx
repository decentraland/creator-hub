import React, { useCallback, useState } from 'react';
import { isValid as isValidAddress } from 'decentraland-ui2/dist/components/AddressField/utils';
import { Box, Dialog, DialogContent, DialogTitle, TextField, Typography } from 'decentraland-ui2';
import { t } from '/@/modules/store/translation/utils';
import { Row } from '/@/components/Row';
import { Button } from '/@/components/Button';
import './styles.css';

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (address: string) => void;
};

const WorldPermissionsAddCollaboratorDialogComponent: React.FC<Props> = React.memo(
  ({ open, onClose, onSubmit }) => {
    const [address, setAddress] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleAddressChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
      setAddress(event.target.value);
      setError(null);
    }, []);

    const handleSubmit = useCallback(() => {
      if (!address) {
        setError(t('modal.world_permissions.invalid_address'));
        return;
      }
      if (!isValidAddress(address)) {
        setError(t('modal.world_permissions.invalid_address'));
        return;
      }
      onSubmit(address);
      setAddress('');
      setError(null);
    }, [address, onSubmit]);

    const handleClose = useCallback(() => {
      setAddress('');
      setError(null);
      onClose();
    }, [onClose]);

    const isValid = address.length > 0 && !error;

    return (
      <Dialog
        open={open}
        onClose={handleClose}
        className="WorldPermissionsDialog"
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle className="DialogTitle">
          {t('modal.world_permissions.collaborators.dialog.title')}
        </DialogTitle>
        <DialogContent className="DialogContent">
          <Box className="DialogField">
            <Typography
              variant="body2"
              className="DialogLabel"
            >
              {t('modal.world_permissions.collaborators.dialog.label')}
            </Typography>
            <TextField
              placeholder="0x..."
              value={address}
              onChange={handleAddressChange}
              variant="outlined"
              size="small"
              fullWidth
              autoFocus
              error={!!error}
              helperText={error}
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

WorldPermissionsAddCollaboratorDialogComponent.displayName =
  'WorldPermissionsAddCollaboratorDialog';

export const WorldPermissionsAddCollaboratorDialog = WorldPermissionsAddCollaboratorDialogComponent;
