import React, { useCallback, useState } from 'react';
import { isValid as isValidAddress } from 'decentraland-ui2/dist/components/AddressField/utils';
import { Box, Tab, Tabs, TextField, Typography } from 'decentraland-ui2';
import { t } from '/@/modules/store/translation/utils';
import { Button } from '/@/components/Button';
import './styles.css';

type Props = {
  onSubmitAddress: (address: string) => void;
  onCancel: () => void;
};

export const WorldPermissionsAddUserForm: React.FC<Props> = React.memo(
  ({ onSubmitAddress, onCancel }) => {
    const [address, setAddress] = useState('');
    const [hasError, setHasError] = useState(false);
    const [activeTab, setActiveTab] = useState(0);

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
      onCancel();
    }, [onCancel]);

    const handleTabChange = useCallback((_: React.SyntheticEvent, newValue: number) => {
      setActiveTab(newValue);
    }, []);

    return (
      <Box className="AddUserForm">
        <Typography
          variant="h6"
          className="AddUserFormTitle"
        >
          {t('modal.world_permissions.access.new_invite')}
        </Typography>

        <Tabs
          className="AddUserFormTabs"
          value={activeTab}
          onChange={handleTabChange}
        >
          <Tab label={t('modal.world_permissions.access.invite_tabs.wallet_address')} />
          <Tab
            label={t('modal.world_permissions.access.invite_tabs.community')}
            disabled
          />
          <Tab
            label={t('modal.world_permissions.access.invite_tabs.import_csv')}
            disabled
          />
        </Tabs>

        <TextField
          placeholder="0x..."
          variant="outlined"
          size="medium"
          fullWidth
          value={address}
          onChange={handleChangeAddress}
          error={hasError}
          helperText={hasError ? t('modal.world_permissions.access.wrong_address_format') : ''}
        />

        <Box className="AddUserFormActions">
          <Button
            onClick={handleCancel}
            color="secondary"
          >
            {t('modal.world_permissions.access.cancel')}
          </Button>
          <Button
            onClick={handleAddAddress}
            disabled={!address || hasError}
            color="primary"
          >
            {t('modal.world_permissions.access.confirm')}
          </Button>
        </Box>
      </Box>
    );
  },
);
