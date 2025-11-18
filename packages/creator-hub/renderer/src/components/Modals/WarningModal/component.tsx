import { useState, useCallback } from 'react';
import { Box, Button, Typography, Checkbox, FormControlLabel } from 'decentraland-ui2';

import { t } from '/@/modules/store/translation/utils';
import { useSettings } from '/@/hooks/useSettings';
import { Modal } from '../index';

import './styles.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function WarningModal({ open, onClose }: Props) {
  const { settings, updateAppSettings } = useSettings();
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleCheckboxChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setDontShowAgain(event.target.checked);
  }, []);

  const handleContinue = useCallback(() => {
    if (dontShowAgain) {
      updateAppSettings({
        ...settings,
        previewOptions: {
          ...settings.previewOptions,
          showWarnings: false,
        },
      });
    }
    onClose();
  }, [dontShowAgain, settings, updateAppSettings, onClose]);

  return (
    <Modal
      size="tiny"
      open={open}
    >
      <Box className="WarningModal">
        <Typography variant="h5">{t('modal.warning.title')}</Typography>
        <Typography
          variant="body1"
          className="message"
        >
          {t('modal.warning.message')}
        </Typography>
        <Box className="CheckboxContainer">
          <FormControlLabel
            control={
              <Checkbox
                checked={dontShowAgain}
                onChange={handleCheckboxChange}
              />
            }
            label={t('modal.warning.dont_show_again')}
          />
        </Box>
        <Box className="ButtonContainer">
          <Button
            variant="contained"
            className="actionButton"
            onClick={handleContinue}
          >
            {t('modal.warning.continue')}
          </Button>
        </Box>
      </Box>
    </Modal>
  );
}
