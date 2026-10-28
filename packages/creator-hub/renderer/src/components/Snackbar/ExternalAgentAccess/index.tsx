import { useCallback } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import { Alert, Button, IconButton } from 'decentraland-ui2';

import { t } from '/@/modules/store/translation/utils';
import { useSettings } from '/@/hooks/useSettings';

// An AI agent outside the Hub turned on its own access to the MCP server. It stays up until
// dismissed, so the creator sees it and can take the access back in one click.
export function ExternalAgentAccess({ onClose }: { onClose: () => void }) {
  const { settings, updateAppSettings } = useSettings();

  const handleTurnOff = useCallback(() => {
    updateAppSettings({ ...settings, exposeMcpServer: false });
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
            onClick={handleTurnOff}
            sx={{ whiteSpace: 'nowrap' }}
          >
            {t('snackbar.external_agent_access.actions.turn_off')}
          </Button>
          <IconButton onClick={onClose}>
            <CloseIcon color="secondary" />
          </IconButton>
        </>
      }
      sx={{ alignItems: 'center' }}
    >
      {t('snackbar.external_agent_access.title')}
    </Alert>
  );
}
