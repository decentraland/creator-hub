import { Box } from 'decentraland-ui2';

import { t } from '/@/modules/store/translation/utils';
import { Modal, onBackNoop } from '..';
import type { Props } from './types';

import './styles.css';

export function MobileQRCode({ open, onClose, url, qr }: Props) {
  const handleClose = (
    _event: React.MouseEvent<HTMLButtonElement>,
    reason?: 'backdropClick' | 'escapeKeyDown',
  ) => {
    if (reason === 'backdropClick') return;
    onClose();
  };

  return (
    <Modal
      className="MobileQRCodeModal"
      open={open}
      size="tiny"
      title={t('modal.mobile_qr.title')}
      subtitle={t('modal.mobile_qr.description')}
      onBack={onBackNoop}
      onClose={handleClose as any}
    >
      <Box className="MobileQRCodeContent">
        <Box className="QRContainer">
          <img
            src={qr}
            alt="QR Code"
            className="QRImage"
          />
        </Box>
        <span className="Url">{url}</span>
        <span className="Disclaimer">{t('modal.mobile_qr.disclaimer')}</span>
      </Box>
    </Modal>
  );
}
