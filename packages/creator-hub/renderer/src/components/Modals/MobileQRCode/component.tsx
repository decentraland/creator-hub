import { useEffect, useState } from 'react';
import { Box } from 'decentraland-ui2';
import { editor } from '#preload';
import type { SceneLogSessionInfo } from '/shared/types/ipc';

import { t } from '/@/modules/store/translation/utils';
import { Modal, onBackNoop } from '..';
import type { Props } from './types';

import './styles.css';

export function MobileQRCode({ open, onClose, url, qr }: Props) {
  const [sessions, setSessions] = useState<SceneLogSessionInfo[]>([]);

  useEffect(() => {
    if (!open) {
      setSessions([]);
      return;
    }

    let active = true;
    const poll = async () => {
      try {
        const result = await editor.getSceneLogSessions();
        if (active) setSessions(result);
      } catch (err) {
        console.warn('[MobileQRCode] getSceneLogSessions failed:', err);
      }
    };

    poll();
    const interval = setInterval(poll, 2000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [open]);

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
        <Box className="SessionsContainer">
          {sessions.length === 0 ? (
            <span className="SessionStatus waiting">Waiting for mobile connection...</span>
          ) : (
            sessions.map(s => (
              <Box
                key={s.id}
                className="SessionItem"
              >
                <span className="SessionBadge connected">Session #{s.id}</span>
                <span className="SessionMessages">{s.messageCount.toLocaleString()} entries</span>
              </Box>
            ))
          )}
        </Box>
        <span className="Disclaimer">{t('modal.mobile_qr.disclaimer')}</span>
      </Box>
    </Modal>
  );
}
