import { useCallback, useEffect, useState } from 'react';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
} from 'decentraland-ui2';

import { ai, analytics } from '#preload';

import { RENDERER } from '/shared/types/settings';
import { t } from '/@/modules/store/translation/utils';
import type { BaseTabProps } from '../../types';

import './styles.css';

const ExperimentalTab = ({ settings, updateSettings }: BaseTabProps) => {
  const handleRendererChange = useCallback(
    (renderer: RENDERER) => {
      updateSettings({ ...settings, renderer });
    },
    [settings, updateSettings],
  );

  const handleGuiEditorChange = useCallback(
    (checked: boolean) => {
      updateSettings({ ...settings, guiEditor: checked });
      void analytics.track('Toggle UI Editor', { enabled: checked });
    },
    [settings, updateSettings],
  );

  const handleAiAssistantChange = useCallback(
    (checked: boolean) => {
      // The API-key option only affects the in-app assistant, so it follows it off.
      updateSettings({
        ...settings,
        aiAssistant: checked,
        useApiKeyFromEnv: checked ? settings.useApiKeyFromEnv : false,
      });
    },
    [settings, updateSettings],
  );

  const handleUseApiKeyFromEnvChange = useCallback(
    (checked: boolean) => {
      updateSettings({ ...settings, useApiKeyFromEnv: checked });
    },
    [settings, updateSettings],
  );

  const handleExposeMcpChange = useCallback(
    (checked: boolean) => {
      updateSettings({ ...settings, exposeMcpServer: checked });
    },
    [settings, updateSettings],
  );

  // MCP server connection details, fetched only while the toggle is on. Not persisted:
  // the URL/token are runtime values (a fresh port + token per app launch), so they're
  // read on demand rather than stored in settings.
  const [mcpInfo, setMcpInfo] = useState<{ url: string; token: string } | null>(null);
  const [mcpCopied, setMcpCopied] = useState(false);

  useEffect(() => {
    if (!settings.exposeMcpServer) {
      setMcpInfo(null);
      return;
    }
    let cancelled = false;
    void ai.getMcpServerInfo().then(
      info => !cancelled && setMcpInfo(info),
      () => !cancelled && setMcpInfo(null),
    );
    return () => {
      cancelled = true;
    };
  }, [settings.exposeMcpServer]);

  const mcpConfigSnippet =
    mcpInfo &&
    JSON.stringify(
      {
        mcpServers: {
          'creator-hub': {
            type: 'http',
            url: mcpInfo.url,
            headers: { Authorization: `Bearer ${mcpInfo.token}` },
          },
        },
      },
      null,
      2,
    );

  const handleCopyMcpConfig = useCallback(() => {
    if (mcpConfigSnippet === null || mcpConfigSnippet === undefined) return;
    void navigator.clipboard.writeText(mcpConfigSnippet).then(() => {
      setMcpCopied(true);
      setTimeout(() => setMcpCopied(false), 2000);
    });
  }, [mcpConfigSnippet]);

  return (
    <Box className="FormContainer">
      <Box className="RendererSubField">
        <Typography variant="body1">{t('modal.app_settings.fields.renderer.label')}</Typography>
        <Select
          fullWidth
          value={settings.renderer}
          onChange={event => handleRendererChange(event.target.value as RENDERER)}
        >
          <MenuItem value={RENDERER.BABYLON}>
            {t('modal.app_settings.fields.renderer.babylon')}
          </MenuItem>
          <MenuItem value={RENDERER.BEVY}>{t('modal.app_settings.fields.renderer.bevy')}</MenuItem>
        </Select>
      </Box>
      <Box className="GuiEditorField">
        <FormControlLabel
          control={
            <Switch
              checked={!!settings.guiEditor}
              onChange={(_event, checked) => handleGuiEditorChange(checked)}
            />
          }
          label={t('modal.app_settings.fields.gui_editor.toggle')}
        />
        <Typography
          variant="body2"
          color="text.secondary"
          className="ExperimentalHint"
        >
          {t('modal.app_settings.fields.gui_editor.hint')}
        </Typography>
      </Box>
      <Box className="GuiEditorField">
        <FormControlLabel
          control={
            <Checkbox
              checked={!!settings.aiAssistant}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                handleAiAssistantChange(event.target.checked)
              }
            />
          }
          label={t('modal.app_settings.fields.ai_assistant.label')}
        />
        {settings.aiAssistant && (
          <Box className="ExperimentalNestedField">
            <Typography variant="caption">
              {t('modal.app_settings.fields.ai_assistant.help')}
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  checked={!!settings.useApiKeyFromEnv}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    handleUseApiKeyFromEnvChange(event.target.checked)
                  }
                />
              }
              label={t('modal.app_settings.fields.ai_api_key.label')}
            />
            {settings.useApiKeyFromEnv && (
              <Typography variant="caption">
                {t('modal.app_settings.fields.ai_api_key.help')}
              </Typography>
            )}
          </Box>
        )}
      </Box>
      <Box className="GuiEditorField">
        <FormControlLabel
          control={
            <Checkbox
              checked={!!settings.exposeMcpServer}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                handleExposeMcpChange(event.target.checked)
              }
            />
          }
          label={t('modal.app_settings.fields.mcp_server.label')}
        />
        {settings.exposeMcpServer && (
          <Box className="ExperimentalNestedField">
            <Typography variant="caption">
              {t('modal.app_settings.fields.mcp_server.help')}
            </Typography>
            {mcpConfigSnippet !== null && mcpConfigSnippet !== undefined ? (
              <>
                <TextField
                  value={mcpConfigSnippet}
                  multiline
                  fullWidth
                  minRows={7}
                  InputProps={{ readOnly: true }}
                />
                <Button
                  color="secondary"
                  size="small"
                  startIcon={<ContentCopyIcon fontSize="small" />}
                  onClick={handleCopyMcpConfig}
                >
                  {mcpCopied
                    ? t('modal.app_settings.fields.mcp_server.copied')
                    : t('modal.app_settings.fields.mcp_server.copy')}
                </Button>
                <Typography variant="caption">
                  {t('modal.app_settings.fields.mcp_server.note')}
                </Typography>
              </>
            ) : (
              <CircularProgress size={20} />
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default ExperimentalTab;
