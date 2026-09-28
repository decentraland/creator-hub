import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  IconButton,
  Switch,
  TextField,
  Typography,
} from 'decentraland-ui2';

import { ai } from '#preload';

import { AI_CLI_COMMANDS, type AiProviderInfo } from '/shared/types/ai';
import { t } from '/@/modules/store/translation/utils';
import { useCliSignIn } from '/@/hooks/useCliSignIn';
import type { BaseTabProps } from '../../types';

import './styles.css';

/** A lightweight expand/collapse section built from a chevron and a title. */
function Accordion({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <Box className="SettingsAccordion">
      <button
        type="button"
        className="SettingsAccordionHeader"
        onClick={onToggle}
      >
        <KeyboardArrowDownIcon
          fontSize="small"
          className={`SettingsAccordionChevron${expanded ? ' expanded' : ''}`}
        />
        <span className="SettingsAccordionTitle">{title}</span>
      </button>
      {expanded && <Box className="SettingsAccordionBody">{children}</Box>}
    </Box>
  );
}

/** A read-only command line with a copy button and an optional label above it. */
function CommandField({ label, value }: { label?: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [value]);
  return (
    <Box className="CommandFieldWrapper">
      {label !== undefined && (
        <Typography
          variant="caption"
          color="text.secondary"
        >
          {label}
        </Typography>
      )}
      <Box className="CommandField">
        <code>{value}</code>
        <IconButton
          size="small"
          aria-label={t('modal.app_settings.fields.ai_connect.copy')}
          onClick={copy}
        >
          <ContentCopyIcon
            fontSize="small"
            color={copied ? 'success' : 'inherit'}
          />
        </IconButton>
      </Box>
    </Box>
  );
}

/** One agent in the Connect section: status, in-app sign in/out and a Via Terminal fallback. */
function AgentConnect({ info, onRecheck }: { info: AiProviderInfo; onRecheck: () => void }) {
  const { signIn, start, cancel } = useCliSignIn(info.id, onRecheck);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const cmds = AI_CLI_COMMANDS[info.id];

  const handleSignOut = useCallback(() => {
    void ai.signOutCli(info.id).then(onRecheck);
  }, [info.id, onRecheck]);

  return (
    <Box className="AgentConnect">
      <Box className="AgentConnectHeader">
        <span className="AgentName">{info.label}</span>
        {info.available && (
          <span className="AgentStatus">
            <span className="AgentStatusDot" />
            {t('modal.app_settings.fields.ai_connect.connected')}
          </span>
        )}
        {info.available ? (
          <button
            type="button"
            className="AgentSignLink"
            onClick={handleSignOut}
          >
            {t('modal.app_settings.fields.ai_connect.sign_out')}
          </button>
        ) : signIn.busy ? (
          <button
            type="button"
            className="AgentSignLink"
            onClick={cancel}
          >
            {t('modal.app_settings.fields.ai_connect.cancel')}
          </button>
        ) : info.managedSignIn === true ? (
          <button
            type="button"
            className="AgentSignLink primary"
            onClick={() => void start()}
          >
            {t('modal.app_settings.fields.ai_connect.sign_in')}
          </button>
        ) : null}
      </Box>
      {signIn.busy && signIn.message !== '' && (
        <Typography
          variant="caption"
          color="text.secondary"
        >
          {signIn.message}
        </Typography>
      )}
      {signIn.url !== null && <CommandField value={signIn.url} />}
      {signIn.error !== null && (
        <Typography
          variant="caption"
          color="error"
        >
          {signIn.error}
        </Typography>
      )}
      <Accordion
        title={t('modal.app_settings.fields.ai_connect.via_terminal')}
        expanded={terminalOpen}
        onToggle={() => setTerminalOpen(o => !o)}
      >
        <CommandField
          label={t('modal.app_settings.fields.ai_connect.install')}
          value={cmds.install}
        />
        <CommandField
          label={t('modal.app_settings.fields.ai_connect.sign_in_label')}
          value={cmds.signin}
        />
      </Accordion>
    </Box>
  );
}

const AiTab: React.FC<BaseTabProps> = ({ settings, updateSettings }) => {
  const handleAiAssistantChange = useCallback(
    (checked: boolean) => {
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

  const [providers, setProviders] = useState<AiProviderInfo[]>([]);
  const [connectOpen, setConnectOpen] = useState(true);
  const recheckProviders = useCallback(() => {
    void ai.detectProviders().then(
      list => setProviders(list),
      () => setProviders([]),
    );
  }, []);
  useEffect(() => {
    if (settings.aiAssistant) recheckProviders();
    else setProviders([]);
  }, [settings.aiAssistant, recheckProviders]);

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
    <Box className="FormContainer AiTab">
      <Box className="AiField">
        <FormControlLabel
          control={
            <Switch
              checked={!!settings.aiAssistant}
              onChange={(_event, checked) => handleAiAssistantChange(checked)}
            />
          }
          label={t('modal.app_settings.fields.ai_assistant.label')}
        />
        <Typography
          variant="body2"
          color="text.secondary"
          className="AiHint"
        >
          {t('modal.app_settings.fields.ai_assistant.help')}
        </Typography>

        {settings.aiAssistant && (
          <Box className="AiNestedField">
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
            <Typography
              variant="caption"
              color="text.secondary"
              className="AiHint"
            >
              {t('modal.app_settings.fields.ai_api_key.help')}
            </Typography>

            <Accordion
              title={t('modal.app_settings.fields.ai_connect.title')}
              expanded={connectOpen}
              onToggle={() => setConnectOpen(o => !o)}
            >
              {providers.map(info => (
                <AgentConnect
                  key={info.id}
                  info={info}
                  onRecheck={recheckProviders}
                />
              ))}
            </Accordion>
          </Box>
        )}
      </Box>

      {settings.aiAssistant && (
        <>
          <hr className="AiDivider" />
          <Box className="AiField">
            <Accordion
              title={t('modal.app_settings.fields.mcp_server.label')}
              expanded={!!settings.exposeMcpServer}
              onToggle={() => handleExposeMcpChange(!settings.exposeMcpServer)}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                className="AiHint"
              >
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
                    variant="text"
                    size="small"
                    startIcon={<ContentCopyIcon fontSize="small" />}
                    onClick={handleCopyMcpConfig}
                    sx={{
                      backgroundColor: 'var(--dark-gray)',
                      '&:hover': { backgroundColor: 'var(--light-gray)' },
                      '&&&&&&&': { color: 'var(--white)' },
                    }}
                  >
                    {mcpCopied
                      ? t('modal.app_settings.fields.mcp_server.copied')
                      : t('modal.app_settings.fields.mcp_server.copy')}
                  </Button>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    className="AiHint"
                  >
                    {t('modal.app_settings.fields.mcp_server.note')}
                  </Typography>
                </>
              ) : (
                <CircularProgress size={20} />
              )}
            </Accordion>
          </Box>
        </>
      )}
    </Box>
  );
};

export default AiTab;
