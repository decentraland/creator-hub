import { useCallback, useEffect, useState } from 'react';
import CheckIcon from '@mui/icons-material/Check';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import {
  Box,
  Button,
  Checkbox,
  IconButton,
  FormControlLabel,
  Switch,
  TextField,
  Typography,
  FormGroup,
  Select,
  MenuItem,
  CircularProgress,
} from 'decentraland-ui2';

import type { EditorConfig } from '/shared/types/config';
import { RENDERER } from '/shared/types/settings';
import { ai } from '#preload';
import { t } from '/@/modules/store/translation/utils';
import type { EditorTabProps } from '../../types';

import './styles.css';

const EditorTab: React.FC<EditorTabProps> = ({
  settings,
  updateSettings,
  editors,
  loading,
  onSetDefaultEditor,
  onAddEditor,
  onRemoveEditor,
  onSelectEditorPath,
}) => {
  const handleEditorChange = useCallback(
    (selectedPath: string) => {
      if (selectedPath) {
        onSetDefaultEditor(selectedPath);
      }
    },
    [onSetDefaultEditor],
  );

  const handleAddCustomEditor = useCallback(async () => {
    const editorPath = await onSelectEditorPath();
    if (editorPath) {
      onAddEditor(editorPath);
    }
  }, [onSelectEditorPath, onAddEditor]);

  const handlePreviewOptionChange = useCallback(
    (option: keyof typeof settings.previewOptions, checked: boolean) => {
      const newSettings = {
        ...settings,
        previewOptions: {
          ...settings.previewOptions,
          [option]: checked,
        },
      };
      updateSettings(newSettings);
    },
    [settings, updateSettings],
  );

  const handleRendererChange = useCallback(
    (renderer: RENDERER) => {
      updateSettings({ ...settings, renderer });
    },
    [settings, updateSettings],
  );

  const handleExperimentalChange = useCallback(
    (checked: boolean) => {
      // Turning experimental off returns to the stable defaults so no experimental feature
      // stays active while its controls are hidden (renderer back to Babylon, AI off).
      updateSettings({
        ...settings,
        experimental: checked,
        renderer: checked ? settings.renderer : RENDERER.BABYLON,
        aiAssistant: checked ? settings.aiAssistant : false,
      });
    },
    [settings, updateSettings],
  );

  const handleAiAssistantChange = useCallback(
    (checked: boolean) => {
      updateSettings({ ...settings, aiAssistant: checked });
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

  const handleExposeMcpChange = useCallback(
    (checked: boolean) => {
      updateSettings({ ...settings, exposeMcpServer: checked });
    },
    [settings, updateSettings],
  );

  const handleUseApiKeyFromEnvChange = useCallback(
    (checked: boolean) => {
      updateSettings({ ...settings, useApiKeyFromEnv: checked });
    },
    [settings, updateSettings],
  );

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
      <FormGroup className="CodeEditorFormGroup">
        <Typography variant="body1">{t('modal.app_settings.fields.code_editor.label')}</Typography>
        {loading ? (
          <CircularProgress size={24} />
        ) : (
          <Select
            fullWidth
            displayEmpty
            value={(editors && editors.find(e => e.isDefault)?.path) || ''}
            renderValue={value =>
              (editors && editors.find(e => e.path === value)?.name) ||
              'Add or select a default editor'
            }
            onChange={event => handleEditorChange(event.target.value as string)}
          >
            {(editors || []).map((editor: EditorConfig) => (
              <MenuItem
                key={editor.path}
                value={editor.path}
                className="editor-select"
              >
                <span>{editor.name}</span>
                <Box className="EditorActionsBox">
                  {editor.isDefault && <CheckIcon className="default-icon menu-only" />}
                  <IconButton
                    size="small"
                    onClick={e => {
                      e.stopPropagation();
                      onRemoveEditor(editor.path);
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              </MenuItem>
            ))}
            <MenuItem
              className="custom-editor"
              onMouseDown={async (e: React.MouseEvent) => {
                e.preventDefault();
                await handleAddCustomEditor();
              }}
            >
              {t('modal.app_settings.fields.code_editor.choose_device')}
            </MenuItem>
          </Select>
        )}
      </FormGroup>
      <FormGroup className="PreviewOptionsFormGroup">
        <Typography variant="body1">{t('editor.header.actions.preview_options.title')}</Typography>
        <FormControlLabel
          control={
            <Checkbox
              checked={!!settings.previewOptions.debugger}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                handlePreviewOptionChange('debugger', event.target.checked)
              }
            />
          }
          label={t('editor.header.actions.preview_options.debugger')}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={!!settings.previewOptions.enableLandscapeTerrains}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                handlePreviewOptionChange('enableLandscapeTerrains', event.target.checked)
              }
            />
          }
          label={t('editor.header.actions.preview_options.landscape_terrain_enabled')}
        />
      </FormGroup>
      <FormGroup className="AppWarningsFormGroup">
        <Typography variant="body1">{t('modal.app_settings.fields.app_warnings.label')}</Typography>
        <FormControlLabel
          control={
            <Checkbox
              checked={!!settings.previewOptions.showWarnings}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                handlePreviewOptionChange('showWarnings', event.target.checked)
              }
            />
          }
          label={t('modal.app_settings.fields.app_warnings.show_warnings')}
        />
      </FormGroup>
      <FormGroup className="ExperimentalFormGroup">
        <FormControlLabel
          control={
            <Switch
              checked={!!settings.experimental}
              onChange={(_event, checked) => handleExperimentalChange(checked)}
            />
          }
          label={t('modal.app_settings.fields.experimental.label')}
        />
        {settings.experimental && (
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
              <MenuItem value={RENDERER.BEVY}>
                {t('modal.app_settings.fields.renderer.bevy')}
              </MenuItem>
            </Select>
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
              <Typography variant="caption">
                {t('modal.app_settings.fields.ai_assistant.help')}
              </Typography>
            )}
          </Box>
        )}
      </FormGroup>
      <FormGroup className="McpServerFormGroup">
        <FormControlLabel
          control={
            <Switch
              checked={!!settings.exposeMcpServer}
              onChange={(_event, checked) => handleExposeMcpChange(checked)}
            />
          }
          label={t('modal.app_settings.fields.mcp_server.label')}
        />
        {settings.exposeMcpServer && (
          <Box className="McpServerSubField">
            <Typography variant="body2">
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
      </FormGroup>
      <FormGroup className="ApiKeyFormGroup">
        <FormControlLabel
          control={
            <Switch
              checked={!!settings.useApiKeyFromEnv}
              onChange={(_event, checked) => handleUseApiKeyFromEnvChange(checked)}
            />
          }
          label={t('modal.app_settings.fields.ai_api_key.label')}
        />
        <Typography variant="caption">{t('modal.app_settings.fields.ai_api_key.help')}</Typography>
      </FormGroup>
    </Box>
  );
};

export default EditorTab;
