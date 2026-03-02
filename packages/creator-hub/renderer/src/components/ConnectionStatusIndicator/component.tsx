import { useState, useCallback } from 'react';
import SignalWifiOffIcon from '@mui/icons-material/SignalWifiOff';
import { Tooltip, IconButton, Box } from 'decentraland-ui2';

import { useConnectionStatus } from '/@/hooks/useConnectionStatus';
import { ConnectionStatus } from '/@/lib/connection';
import { t } from '/@/modules/store/translation/utils';
import { ConnectionModal } from './ConnectionModal';

import './styles.css';

export function ConnectionStatusIndicator() {
  const { status } = useConnectionStatus();
  const [modalOpen, setModalOpen] = useState(false);

  const handleClick = useCallback(() => {
    setModalOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setModalOpen(false);
  }, []);

  if (status !== ConnectionStatus.OFFLINE) return null;

  return (
    <>
      <Box className="ConnectionStatusIndicator">
        <Tooltip title={t('connection.offline.tooltip')}>
          <IconButton
            aria-label="connection-status"
            className="connection-status-offline"
            onClick={handleClick}
          >
            <SignalWifiOffIcon className="offline-icon" />
          </IconButton>
        </Tooltip>
      </Box>
      <ConnectionModal
        open={modalOpen}
        onClose={handleClose}
      />
    </>
  );
}
