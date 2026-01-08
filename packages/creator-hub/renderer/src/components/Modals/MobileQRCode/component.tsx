import { useCallback } from 'react';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { Box, Button, Typography } from 'decentraland-ui2';

import { misc } from '#preload';

import { t } from '/@/modules/store/translation/utils';
import { useSnackbar } from '/@/hooks/useSnackbar';
import { Modal } from '../index';

import './styles.css';

interface Props {
  open: boolean;
  data: { url: string; qr: string };
  onClose: () => void;
}

export function MobileQRCodeModal({ open, data, onClose }: Props) {
  const { pushGeneric } = useSnackbar();

  const handleCopyUrl = useCallback(() => {
    void misc.copyToClipboard(data.url);
    pushGeneric('success', t('modal.mobile_qr.copied'));
  }, [data.url, pushGeneric]);

  return (
    <Modal size="tiny" open={open}>
      <Box className="MobileQRCodeModal">
        <Typography variant="h5">{t('modal.mobile_qr.title')}</Typography>
        <Typography variant="body1" className="message">
          {t('modal.mobile_qr.scan_message')}
        </Typography>
        <Box className="QRContainer">
          <img src={data.qr} alt="QR Code" className="qr-image" />
        </Box>
        <Box className="UrlContainer">
          <Typography variant="body2" className="url">
            {data.url}
          </Typography>
          <Button
            variant="text"
            size="small"
            onClick={handleCopyUrl}
            startIcon={<ContentCopyIcon />}
          >
            {t('modal.mobile_qr.copy')}
          </Button>
        </Box>
        <Box className="ButtonContainer">
          <Button variant="contained" onClick={onClose}>
            {t('modal.mobile_qr.close')}
          </Button>
        </Box>
      </Box>
    </Modal>
  );
}
