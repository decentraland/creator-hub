import { useCallback } from 'react';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import { Alert, Button } from 'decentraland-ui2';

import { t } from '/@/modules/store/translation/utils';
import { useSettings } from '/@/hooks/useSettings';

// An AI agent outside the Hub asked for access to the open scene. It stays up until the
// creator answers; only "Allow" turns access on.
export function ExternalAgentAccess({ onClose }: { onClose: () => void }) {
  const { settings, updateAppSettings } = useSettings();

  const handleAllow = useCallback(() => {
    updateAppSettings({ ...settings, exposeMcpServer: true });
    onClose();
  }, [settings, updateAppSettings, onClose]);

  return (
    <Alert
      icon={<SmartToyOutlinedIcon color="secondary" />}
      severity="info"
      action={
        <>
          <Button
            variant="text"
            onClick={onClose}
            sx={{ whiteSpace: 'nowrap' }}
          >
            {t('snackbar.external_agent_access.actions.deny')}
          </Button>
          <Button
            variant="contained"
            onClick={handleAllow}
            sx={{ whiteSpace: 'nowrap' }}
          >
            {t('snackbar.external_agent_access.actions.allow')}
          </Button>
        </>
      }
      sx={{ alignItems: 'center' }}
    >
      {t('snackbar.external_agent_access.title')}
    </Alert>
  );
}
