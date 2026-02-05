import React, { useCallback, useState } from 'react';
import { isValid as isValidAddress } from 'decentraland-ui2/dist/components/AddressField/utils';
import { Box, TextField } from 'decentraland-ui2';
import { t } from '/@/modules/store/translation/utils';
import { Row } from '/@/components/Row';
import { Button } from '/@/components/Button';
import './styles.css';

type Props = {
  addButtonLabel: string;
  cancelButtonLabel?: string;
  onSubmitAddress: (address: string) => void;
  onCancel?: () => void;
};

export const WorldPermissionsAddUserForm: React.FC<Props> = React.memo(
  ({ addButtonLabel, cancelButtonLabel, onSubmitAddress, onCancel }) => {
    const [address, setAddress] = useState('');
    const [hasError, setHasError] = useState(false);

    const handleChangeAddress = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
      setAddress(event.target.value);
      setHasError(false);
    }, []);

    const handleAddAddress = useCallback(async () => {
      if (hasError || !address) return;
      if (!isValidAddress(address)) {
        setHasError(true);
        return;
      }
      onSubmitAddress(address);
      setAddress('');
    }, [address, hasError, onSubmitAddress]);

    const handleCancel = useCallback(() => {
      setAddress('');
      setHasError(false);
      onCancel?.();
    }, [onCancel]);

    return (
      <Box className="AddUserWrapper">
        <TextField
          placeholder="0x..."
          variant="outlined"
          size="small"
          fullWidth
          value={address}
          onChange={handleChangeAddress}
          error={hasError}
          helperText={hasError ? t('modal.world_permissions.invalid_address') : ''}
        />
        <Row className="AddUserActions">
          {onCancel && (
            <Button
              onClick={handleCancel}
              color="secondary"
            >
              {cancelButtonLabel || t('modal.cancel')}
            </Button>
          )}
          <Button
            onClick={handleAddAddress}
            disabled={!address || hasError}
            color="primary"
          >
            {addButtonLabel}
          </Button>
        </Row>
      </Box>
    );
  },
);
