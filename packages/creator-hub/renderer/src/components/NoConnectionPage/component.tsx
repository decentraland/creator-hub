import { useCallback } from 'react';
import SignalWifiOffIcon from '@mui/icons-material/SignalWifiOff';
import { Container, Typography, Button, Box } from 'decentraland-ui2';
import { t } from '/@/modules/store/translation/utils';
import { useConnectionStatus } from '/@/hooks/useConnectionStatus';
import './styles.css';

export function NoConnectionPage() {
  const { checkNow } = useConnectionStatus();

  const handleRetry = useCallback(async () => {
    await checkNow();
  }, [checkNow]);

  return (
    <Container className="NoConnectionPage">
      <Box className="content">
        <SignalWifiOffIcon className="icon" />
        <Typography
          variant="h3"
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
        <Button
          variant="contained"
          size="large"
          onClick={handleRetry}
          className="retry-button"
        >
          {t('connection.offline.retry')}
        </Button>
      </Box>
    </Container>
  );
}
