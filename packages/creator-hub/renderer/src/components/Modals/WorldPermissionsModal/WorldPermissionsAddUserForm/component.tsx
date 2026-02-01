import React, { useCallback, useState } from 'react';
import AddIcon from '@mui/icons-material/AddRounded';
import { isValid as isValidAddress } from 'decentraland-ui2/dist/components/AddressField/utils';
import { TextField } from 'decentraland-ui2';
import { t } from '/@/modules/store/translation/utils';
import { Row } from '/@/components/Row';
import { Button } from '/@/components/Button';
import './styles.css';

type Props = {
  addButtonLabel: string;
  onSubmitAddress: (address: string) => void;
};

export const WorldPermissionsAddUserForm: React.FC<Props> = React.memo(
  ({ addButtonLabel, onSubmitAddress }) => {
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

    return (
      <Row className="AddUserWrapper">
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
        <Button
          onClick={handleAddAddress}
          disabled={!address || hasError}
          color="secondary"
          startIcon={<AddIcon />}
        >
          {addButtonLabel}
        </Button>
      </Row>
    );
  },
);
