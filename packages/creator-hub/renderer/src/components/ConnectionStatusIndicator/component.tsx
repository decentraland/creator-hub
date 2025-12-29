import { useMemo, useState, useCallback } from 'react';
import SignalWifiOffIcon from '@mui/icons-material/SignalWifiOff';
import SignalCellular2BarIcon from '@mui/icons-material/SignalCellular2Bar';
import { Tooltip, IconButton, Box } from 'decentraland-ui2';

import { useConnectionStatus } from '/@/hooks/useConnectionStatus';
import { ConnectionStatus } from '/@/lib/connection';
import { t } from '/@/modules/store/translation/utils';
import { ConnectionModal } from './ConnectionModal';

import './styles.css';

export function ConnectionStatusIndicator() {
  const { status, rtt, downlink } = useConnectionStatus();
  const [modalOpen, setModalOpen] = useState(false);

  const handleClick = useCallback(() => {
    setModalOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setModalOpen(false);
  }, []);

  const tooltipContent = useMemo(() => {
    if (status === ConnectionStatus.OFFLINE) return t('connection.offline.tooltip');
    if (status === ConnectionStatus.SLOW) {
      const details = [];
      if (rtt) details.push(`RTT: ${rtt}ms`);
      if (downlink) details.push(`${downlink} Mbps`);
      const detailsText = details.length > 0 ? ` (${details.join(', ')})` : '';
      return t('connection.slow.tooltip') + detailsText;
    }
    return '';
  }, [status, rtt, downlink]);

  if (status === ConnectionStatus.ONLINE) return null;

  return (
    <>
      <Box className="ConnectionStatusIndicator">
        <Tooltip title={tooltipContent}>
          <IconButton
            aria-label="connection-status"
            className={`connection-status-${status}`}
            onClick={handleClick}
          >
            {status === ConnectionStatus.OFFLINE ? (
              <SignalWifiOffIcon className="offline-icon" />
            ) : (
              <SignalCellular2BarIcon className="slow-icon" />
            )}
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
