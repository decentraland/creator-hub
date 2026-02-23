import { useCallback, useState, useEffect, useRef } from 'react';
import SignalWifiOffIcon from '@mui/icons-material/SignalWifiOff';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import { Typography, Button, Box, CircularProgress, IconButton } from 'decentraland-ui2';

import { t } from '/@/modules/store/translation/utils';
import { useConnectionStatus } from '/@/hooks/useConnectionStatus';
import { ConnectionStatus } from '/@/lib/connection';
import { Modal } from '../Modals';
import './modal-styles.css';

const COOLDOWN_MS = 3_000;

interface ConnectionModalProps {
  open: boolean;
  onClose: () => void;
}

export function ConnectionModal({ open, onClose }: ConnectionModalProps) {
  const { checkNow, status } = useConnectionStatus();
  const [isChecking, setIsChecking] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownIntervalRef = useRef<NodeJS.Timeout>();

  const handleRetry = useCallback(async () => {
    if (isChecking || cooldown > 0) return;

    setIsChecking(true);
    try {
      await checkNow();
    } finally {
      setIsChecking(false);

      setCooldown(COOLDOWN_MS / 1000);
      cooldownIntervalRef.current = setInterval(() => {
        setCooldown(prev => {
          if (prev <= 1) {
            if (cooldownIntervalRef.current) {
              clearInterval(cooldownIntervalRef.current);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }, [checkNow, isChecking, cooldown]);

  useEffect(() => {
    return () => {
      if (cooldownIntervalRef.current) {
        clearInterval(cooldownIntervalRef.current);
      }
    };
  }, []);

  // auto-close when connection is restored
  useEffect(() => {
    if (status === ConnectionStatus.ONLINE && open) {
      onClose();
    }
  }, [status, open, onClose]);

  const isDisabled = isChecking || cooldown > 0;

  return (
    <Modal
      size="tiny"
      open={open}
    >
      <Box className="ConnectionModal">
        <div className="CloseButtonContainer">
          <IconButton onClick={onClose}>
            <CloseIcon fontSize="medium" />
          </IconButton>
        </div>
        <Box className="icon-container">
          <SignalWifiOffIcon className="icon offline" />
        </Box>
        <Typography
          variant="h5"
          className="title"
        >
          {t('connection.offline.title')}
        </Typography>
        <Typography
          variant="body1"
          className="message"
        >
          {t('connection.offline.message')}
        </Typography>
        <Box className="actions">
          <Button
            variant="contained"
            size="large"
            onClick={handleRetry}
            disabled={isDisabled}
            className="retry-button"
            startIcon={isChecking ? <CircularProgress size={20} /> : <RefreshIcon />}
          >
            {isChecking
              ? t('connection.offline.checking')
              : cooldown > 0
                ? `${t('connection.offline.retry')} (${cooldown}s)`
                : t('connection.offline.retry')}
          </Button>
        </Box>
      </Box>
    </Modal>
  );
}
