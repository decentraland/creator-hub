import React, { useCallback, useState } from 'react';
import { isValid as isValidAddress } from 'decentraland-ui2/dist/components/AddressField/utils';
import { Box, TextField, Typography } from 'decentraland-ui2';
import { t } from '/@/modules/store/translation/utils';
import { Row } from '/@/components/Row';
import { Button } from '/@/components/Button';
import './styles.css';

type Props = {
  onCancel: () => void;
  onSubmit: (address: string) => void;
};

const WorldPermissionsAddCollaboratorDialogComponent: React.FC<Props> = React.memo(
  ({ onCancel, onSubmit }) => {
    const [address, setAddress] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleAddressChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
      setAddress(event.target.value);
      setError(null);
    }, []);

    const handleSubmit = useCallback(() => {
      if (!address || !isValidAddress(address)) {
        setError(t('modal.world_permissions.invalid_address'));
        return;
      }
      onSubmit(address);
      setAddress('');
      setError(null);
    }, [address, onSubmit]);

    const isValid = address.length > 0 && !error;

    return (
      <>
        <Box className="AddCollaboratorForm">
          <Typography
            variant="h5"
            className="CollaboratorFormTitle"
          >
            {t('modal.world_permissions.collaborators.dialog.title')}
          </Typography>
          <TextField
            placeholder="0x..."
            variant="outlined"
            size="medium"
            autoFocus
            fullWidth
            value={address}
            onChange={handleAddressChange}
            error={!!error}
            helperText={error}
          />
          <Row className="CollaboratorFormActions">
            <Button
              onClick={onCancel}
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
      </>
    );
  },
);

WorldPermissionsAddCollaboratorDialogComponent.displayName =
  'WorldPermissionsAddCollaboratorDialog';

export const WorldPermissionsAddCollaboratorDialog = WorldPermissionsAddCollaboratorDialogComponent;
