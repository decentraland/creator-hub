import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import SendIcon from '@mui/icons-material/Send';
import StopIcon from '@mui/icons-material/Stop';
import AddCommentIcon from '@mui/icons-material/AddComment';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import UndoIcon from '@mui/icons-material/Undo';
import HighlightAltIcon from '@mui/icons-material/HighlightAlt';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import HistoryIcon from '@mui/icons-material/History';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import Markdown, { type MarkdownToJSX } from 'markdown-to-jsx';
import {
  Button,
  CircularProgress,
  IconButton,
  MenuItem,
  Select,
  type SelectChangeEvent,
  TextField,
  Tooltip,
} from 'decentraland-ui2';

import type { AiProvider } from '/shared/types/ai';

import { ai as aiPreload } from '#preload';
import { t } from '/@/modules/store/translation/utils';

import type { AiMessage, AiSessionMeta } from '/@/modules/store/ai/types';
import { toolChipLabel } from './labels';
import {
  AssistantBubble,
  AssistantImage,
  AssistantText,
  BillingDismiss,
  BillingHint,
  CommandLine,
  Composer,
  EmptyState,
  ErrorRow,
  HeaderActions,
  HeaderTitle,
  HistoryBar,
  HistoryList,
  HistoryRow,
  Panel,
  PanelHeader,
  ProviderHint,
  ProviderOption,
  ProviderRow,
  ProviderValueHint,
  SelectionBar,
  SelectionClear,
  SelectionNames,
  SessionText,
  SessionTitle,
  SessionWhen,
  SetupAlt,
  SetupBox,
  SetupDivider,
  SetupStep,
  ThinkingRow,
  ToolChip,
  ToolDetail,
  Transcript,
  UserBubble,
} from './component.styled';

// Render assistant replies as markdown. Raw HTML is disabled so nothing the model emits
// can inject markup, and links open in the default browser (the Electron security layer
// only lets allowlisted origins through, blocking the rest — no navigation of the app).
const MARKDOWN_OPTIONS: MarkdownToJSX.Options = {
  disableParsingRawHTML: true,
  overrides: { a: { props: { target: '_blank', rel: 'noopener noreferrer' } } },
};

// Compact "last used" label for a session in the history menu.
function formatWhen(ts: number): string {
  const min = Math.floor((Date.now() - ts) / 60_000);
  if (min < 1) return t('editor.ai.history.now');
  if (min < 60) return t('editor.ai.history.minutes', { n: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return t('editor.ai.history.hours', { n: hr });
  const day = Math.floor(hr / 24);
  if (day < 7) return t('editor.ai.history.days', { n: day });
  return new Date(ts).toLocaleDateString();
}

// Install + sign-in commands per provider, shown on the setup card when the CLI isn't
// found. Obviously-safe public package names.
const SETUP_COMMANDS: Record<AiProvider, { install: string; signin: string }> = {
  claude: { install: 'npm i -g @anthropic-ai/claude-code', signin: 'claude' },
  codex: { install: 'npm i -g @openai/codex', signin: 'codex login' },
};

// The pure chat surface, driven entirely by props. Both the inline panel (redux-backed)
// and the detached window (mirror-backed) render this — neither reaches into a store from
// here, so the same view works whichever owns the state (#1504).
export interface ChatViewProps {
  providers: { id: AiProvider; label: string; available: boolean; reason?: string }[];
  provider: AiProvider;
  messages: AiMessage[];
  busy: boolean;
  detecting: boolean;
  selection: { id: number; name: string }[];
  // The user dismissed the billing hint for this scene (#1505) — hide it.
  billingDismissed: boolean;
  // The scene's saved conversations (newest first) and which one is active, for the history menu.
  sessions: AiSessionMeta[];
  currentSessionId: string;
  // Shown after the title in the header (the open project) — the detached window uses it.
  title?: string;
  // Inline panel width in px (the user-draggable size). Ignored when detached (fills the window).
  width?: number;
  // True when rendered as the detached window: fills the window and shows a "dock" affordance
  // instead of "pop out".
  detached?: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  onNewChat: () => void;
  onProviderChange: (provider: AiProvider) => void;
  onRevertTurn: (id: string, count: number) => void;
  onRecheck: () => void;
  // Dismiss the billing hint for this scene (persisted per-project).
  onDismissBilling: () => void;
  // Open a past session from the history / delete one.
  onSwitchSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  // Deselect all entities (clears the selection chips).
  onClearSelection: () => void;
  // Open the detached window (inline only — omitted/no-op in the detached window).
  onPopOut?: () => void;
  // Inline: hide the panel. Detached: dock the chat back inline (close the window).
  onClose: () => void;
}

export function ChatView(props: ChatViewProps) {
  const {
    providers,
    provider,
    messages,
    busy,
    detecting,
    selection,
    billingDismissed,
    sessions,
    currentSessionId,
    title,
    width,
    detached = false,
    onSend,
    onStop,
    onNewChat,
    onProviderChange,
    onRevertTurn,
    onRecheck,
    onDismissBilling,
    onSwitchSession,
    onDeleteSession,
    onClearSelection,
    onPopOut,
    onClose,
  } = props;

  const [input, setInput] = useState('');
  const transcriptRef = useRef<HTMLDivElement>(null);
  const [mcpInfo, setMcpInfo] = useState<{ url: string; token: string } | null>(null);
  const [mcpCopied, setMcpCopied] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Saved conversations for the history menu (the current not-yet-used session isn't listed).
  const savedSessions = useMemo(() => sessions.filter(s => s.title !== ''), [sessions]);

  const currentProvider = useMemo(
    () => providers.find(p => p.id === provider),
    [providers, provider],
  );
  const available = currentProvider?.available ?? false;

  // In-app sign-in without a CLI (#1531): install the official CLI on demand + drive its
  // subscription login (browser OAuth), streaming steps here. On success we re-detect so
  // the provider flips to available.
  const [signIn, setSignIn] = useState<{
    busy: boolean;
    message: string;
    url: string | null;
    error: string | null;
  }>({ busy: false, message: '', url: null, error: null });
  // A user cancel kills the CLI, which rejects the sign-in promise — flag it so that
  // expected rejection resets to idle instead of showing a scary "exited with code" error.
  const signInCancelled = useRef(false);

  const handleSignIn = useCallback(async () => {
    signInCancelled.current = false;
    setSignIn({
      busy: true,
      message: t('editor.ai.setup.signin_starting'),
      url: null,
      error: null,
    });
    try {
      await aiPreload.signInCli(provider, event => {
        setSignIn(s =>
          event.type === 'auth'
            ? { ...s, url: event.url, message: t('editor.ai.setup.signin_browser') }
            : { ...s, message: event.message },
        );
      });
      setSignIn({ busy: false, message: '', url: null, error: null });
      onRecheck();
    } catch (e) {
      setSignIn({
        busy: false,
        message: '',
        url: null,
        error: signInCancelled.current ? null : e instanceof Error ? e.message : String(e),
      });
    }
  }, [provider, onRecheck]);

  const handleCancelSignIn = useCallback(() => {
    signInCancelled.current = true;
    void aiPreload.cancelSignInCli();
    setSignIn({ busy: false, message: '', url: null, error: null });
  }, []);

  // Keep the newest message in view as text streams in.
  useEffect(() => {
    const el = transcriptRef.current;
    if (el !== null) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // No CLI installed? Reveal the scene's MCP server so a tool the user already has (Claude
  // Desktop, the VS Code extension, …) can connect to this scene instead (#1502). Fetch it
  // only once detection has concluded the CLI is missing — asking for the info starts the
  // server, which we shouldn't do when the CLI path works.
  useEffect(() => {
    if (detecting || available) {
      setMcpInfo(null);
      return;
    }
    let cancelled = false;
    void aiPreload.getMcpServerInfo().then(
      info => !cancelled && setMcpInfo(info),
      () => !cancelled && setMcpInfo(null),
    );
    return () => {
      cancelled = true;
    };
  }, [detecting, available]);

  const mcpConfigSnippet = useMemo(
    () =>
      mcpInfo === null
        ? null
        : JSON.stringify(
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
          ),
    [mcpInfo],
  );

  const handleCopyMcpConfig = useCallback(() => {
    if (mcpConfigSnippet === null) return;
    void navigator.clipboard.writeText(mcpConfigSnippet).then(() => {
      setMcpCopied(true);
      setTimeout(() => setMcpCopied(false), 2000);
    });
  }, [mcpConfigSnippet]);

  const handleSend = useCallback(() => {
    if (busy || input.trim() === '') return;
    onSend(input.trim());
    setInput('');
  }, [busy, input, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleProviderChange = useCallback(
    (e: SelectChangeEvent) => onProviderChange(e.target.value as AiProvider),
    [onProviderChange],
  );

  const renderSetup = () => {
    const cmds = SETUP_COMMANDS[provider];
    return (
      <SetupBox>
        <strong>{t('editor.ai.setup.title')}</strong>
        <span>{t('editor.ai.setup.description')}</span>
        {/* Primary path (#1531): sign in with the subscription in-app — installs the
            official CLI on demand and drives its browser OAuth. No terminal needed. */}
        <Button
          color="primary"
          size="small"
          disabled={signIn.busy}
          startIcon={signIn.busy ? <CircularProgress size={16} /> : undefined}
          onClick={handleSignIn}
        >
          {t('editor.ai.setup.signin_button', { provider: currentProvider?.label ?? provider })}
        </Button>
        {signIn.busy && signIn.message !== '' && <span>{signIn.message}</span>}
        {signIn.busy && (
          <Button
            color="secondary"
            size="small"
            onClick={handleCancelSignIn}
          >
            {t('editor.ai.setup.signin_cancel')}
          </Button>
        )}
        {signIn.url !== null && (
          <SetupStep>
            <span>{t('editor.ai.setup.signin_browser')}</span>
            <CommandLine>{signIn.url}</CommandLine>
          </SetupStep>
        )}
        {signIn.error !== null && <ErrorRow>{signIn.error}</ErrorRow>}
        <SetupDivider />
        {/* Fallback: run the CLI yourself in a terminal. */}
        <span>{t('editor.ai.setup.manual_title')}</span>
        <SetupStep>
          <span>{t('editor.ai.setup.install')}</span>
          <CommandLine>{cmds.install}</CommandLine>
        </SetupStep>
        <SetupStep>
          <span>{t('editor.ai.setup.signin')}</span>
          <CommandLine>{cmds.signin}</CommandLine>
        </SetupStep>
        <Button
          color="secondary"
          size="small"
          startIcon={detecting ? <CircularProgress size={16} /> : <RefreshIcon />}
          disabled={detecting}
          onClick={onRecheck}
        >
          {t('editor.ai.setup.recheck')}
        </Button>
        <SetupDivider />
        <SetupAlt>
          <strong>{t('editor.ai.setup.alt_title')}</strong>
          <span>{t('editor.ai.setup.alt_description')}</span>
          {mcpConfigSnippet === null ? (
            <CircularProgress size={16} />
          ) : (
            <>
              <CommandLine>{mcpConfigSnippet}</CommandLine>
              <Button
                color="secondary"
                size="small"
                startIcon={<ContentCopyIcon fontSize="small" />}
                onClick={handleCopyMcpConfig}
              >
                {mcpCopied ? t('editor.ai.setup.alt_copied') : t('editor.ai.setup.alt_copy')}
              </Button>
              <span>{t('editor.ai.setup.alt_note')}</span>
            </>
          )}
        </SetupAlt>
      </SetupBox>
    );
  };

  const renderTranscript = () => {
    if (messages.length === 0) {
      return <EmptyState>{t('editor.ai.empty')}</EmptyState>;
    }
    // "Undo AI changes" is offered only on the latest turn: undo is a shared stack, so an
    // older turn's entries aren't on top and can't be cleanly reverted in isolation.
    const lastId = messages[messages.length - 1]?.id;
    return messages.map(msg =>
      msg.role === 'user' ? (
        <UserBubble key={msg.id}>{msg.text}</UserBubble>
      ) : (
        <AssistantBubble key={msg.id}>
          {msg.tools.map((chip, i) => (
            <ToolChip key={i}>
              <span>{toolChipLabel(chip.tool)}</span>
              {chip.detail !== '' && <ToolDetail>{chip.detail}</ToolDetail>}
            </ToolChip>
          ))}
          {msg.images?.map((src, i) => (
            <AssistantImage
              key={`img-${i}`}
              src={src}
              alt={t('editor.ai.screenshot_alt')}
            />
          ))}
          {msg.text !== '' && (
            <AssistantText>
              <Markdown options={MARKDOWN_OPTIONS}>{msg.text}</Markdown>
            </AssistantText>
          )}
          {!msg.done && msg.text === '' && msg.error === undefined && (
            <ThinkingRow>
              <CircularProgress size={12} />
              {t('editor.ai.thinking')}
            </ThinkingRow>
          )}
          {msg.error !== undefined && (
            <ErrorRow>
              {msg.error}
              <div>
                <Button
                  color="secondary"
                  size="small"
                  onClick={() => {
                    const lastUser = [...messages].reverse().find(m => m.role === 'user');
                    if (lastUser !== undefined) onSend(lastUser.text);
                  }}
                >
                  {t('editor.ai.retry')}
                </Button>
              </div>
            </ErrorRow>
          )}
          {msg.id === lastId &&
            msg.done &&
            msg.error === undefined &&
            (msg.mutations ?? 0) > 0 &&
            !msg.reverted && (
              <Button
                color="secondary"
                size="small"
                startIcon={<UndoIcon fontSize="small" />}
                onClick={() => onRevertTurn(msg.id, msg.mutations ?? 0)}
              >
                {t('editor.ai.revert')}
              </Button>
            )}
        </AssistantBubble>
      ),
    );
  };

  return (
    <Panel
      fill={detached}
      panelWidth={width}
      aria-label="ai-chat-panel"
    >
      <PanelHeader>
        <HeaderTitle>
          <SmartToyIcon fontSize="small" />
          {t('editor.ai.title')}
          {title !== undefined && title !== '' ? ` — ${title}` : ''}
        </HeaderTitle>
        <HeaderActions>
          <Tooltip title={t('editor.ai.new_chat')}>
            <span>
              <IconButton
                size="small"
                aria-label={t('editor.ai.new_chat')}
                disabled={busy || messages.length === 0}
                onClick={onNewChat}
              >
                <AddCommentIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          {(savedSessions.length > 0 || historyOpen) && (
            <Tooltip title={t('editor.ai.history.title')}>
              <IconButton
                size="small"
                aria-label={t('editor.ai.history.title')}
                color={historyOpen ? 'primary' : 'default'}
                onClick={() => setHistoryOpen(o => !o)}
              >
                <HistoryIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {!detached && onPopOut !== undefined && (
            <Tooltip title={t('editor.ai.pop_out')}>
              <IconButton
                size="small"
                aria-label={t('editor.ai.pop_out')}
                onClick={onPopOut}
              >
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={detached ? t('editor.ai.dock') : t('editor.ai.toggle')}>
            <IconButton
              size="small"
              aria-label={detached ? t('editor.ai.dock') : t('editor.ai.toggle')}
              onClick={onClose}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </HeaderActions>
      </PanelHeader>

      {available && historyOpen ? (
        <HistoryList>
          <HistoryBar>
            <span>{t('editor.ai.history.title')}</span>
            <Button
              color="secondary"
              size="small"
              startIcon={<AddCommentIcon fontSize="small" />}
              onClick={() => {
                onNewChat();
                setHistoryOpen(false);
              }}
            >
              {t('editor.ai.new_chat')}
            </Button>
          </HistoryBar>
          {savedSessions.length === 0 ? (
            <EmptyState>{t('editor.ai.history.empty')}</EmptyState>
          ) : (
            savedSessions.map(s => (
              <HistoryRow
                key={s.id}
                current={s.id === currentSessionId}
                onClick={() => {
                  onSwitchSession(s.id);
                  setHistoryOpen(false);
                }}
              >
                <SessionText>
                  <SessionTitle>{s.title}</SessionTitle>
                  <SessionWhen>{formatWhen(s.updatedAt)}</SessionWhen>
                </SessionText>
                <IconButton
                  size="small"
                  aria-label={t('editor.ai.history.delete')}
                  onClick={e => {
                    e.stopPropagation();
                    onDeleteSession(s.id);
                  }}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </HistoryRow>
            ))
          )}
        </HistoryList>
      ) : (
        <>
          {providers.length > 1 && (
            <ProviderRow>
              <Select
                size="small"
                fullWidth
                value={provider}
                onChange={handleProviderChange}
                disabled={busy}
                // Show just the active agent's name in the closed box (with a subtle "sign in"
                // cue when it isn't ready), not the full per-row status.
                renderValue={id => {
                  const p = providers.find(x => x.id === id);
                  if (p === undefined) return id;
                  return (
                    <ProviderOption>
                      <span>{p.label}</span>
                      {!p.available && (
                        <ProviderValueHint>{t('editor.ai.provider_signin')}</ProviderValueHint>
                      )}
                    </ProviderOption>
                  );
                }}
              >
                {/* Every agent is selectable — picking one that isn't signed in yet switches the
                    panel to its sign-in screen, so users can add and swap agents on the fly. */}
                {providers.map(p => (
                  <MenuItem
                    key={p.id}
                    value={p.id}
                  >
                    <ProviderOption>
                      <span>{p.label}</span>
                      {!p.available && (
                        <ProviderHint>{t('editor.ai.provider_signin')}</ProviderHint>
                      )}
                    </ProviderOption>
                  </MenuItem>
                ))}
              </Select>
            </ProviderRow>
          )}

          <Transcript ref={transcriptRef}>
            {available ? renderTranscript() : renderSetup()}
          </Transcript>

          {available && selection.length > 0 && (
            <SelectionBar>
              <HighlightAltIcon fontSize="small" />
              <SelectionNames>
                {t('editor.ai.selection', {
                  names: selection.map(s => (s.name !== '' ? s.name : `#${s.id}`)).join(', '),
                })}
              </SelectionNames>
              <SelectionClear
                role="button"
                tabIndex={0}
                onClick={onClearSelection}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClearSelection();
                  }
                }}
              >
                {t('editor.ai.selection_clear')}
              </SelectionClear>
            </SelectionBar>
          )}

          {available && !billingDismissed && (
            <BillingHint>
              <InfoOutlinedIcon fontSize="inherit" />
              <span>
                {t('editor.ai.billing', { provider: currentProvider?.label ?? 'AI' })}{' '}
                <BillingDismiss
                  role="button"
                  tabIndex={0}
                  onClick={onDismissBilling}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onDismissBilling();
                    }
                  }}
                >
                  {t('editor.ai.billing_dismiss')}
                </BillingDismiss>
              </span>
            </BillingHint>
          )}

          <Composer>
            <TextField
              fullWidth
              multiline
              maxRows={6}
              size="small"
              placeholder={t('editor.ai.placeholder')}
              value={input}
              disabled={!available}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            {busy ? (
              <Tooltip title={t('editor.ai.stop')}>
                <IconButton
                  color="error"
                  aria-label={t('editor.ai.stop')}
                  onClick={onStop}
                >
                  <StopIcon />
                </IconButton>
              </Tooltip>
            ) : (
              <Tooltip title={t('editor.ai.send')}>
                <span>
                  <IconButton
                    color="primary"
                    aria-label={t('editor.ai.send')}
                    disabled={!available || input.trim() === ''}
                    onClick={handleSend}
                  >
                    <SendIcon />
                  </IconButton>
                </span>
              </Tooltip>
            )}
          </Composer>
        </>
      )}
    </Panel>
  );
}
