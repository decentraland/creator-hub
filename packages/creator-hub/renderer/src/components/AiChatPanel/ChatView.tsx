import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import StopIcon from '@mui/icons-material/Stop';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import AddCommentIcon from '@mui/icons-material/AddComment';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import UndoIcon from '@mui/icons-material/Undo';
import HighlightAltIcon from '@mui/icons-material/HighlightAlt';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import Markdown, { type MarkdownToJSX } from 'markdown-to-jsx';
import {
  Button,
  CircularProgress,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Select,
  type SelectChangeEvent,
  TextField,
  Tooltip,
} from 'decentraland-ui2';

import type { AiProvider } from '/shared/types/ai';
import { MIN_CLAUDE_CLI_VERSION, isCliVersionOutdated } from '/shared/types/ai';

import { ai as aiPreload } from '#preload';
import { t } from '/@/modules/store/translation/utils';

import type { AiMessage, AiPromptData, AiSessionMeta } from '/@/modules/store/ai/types';
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
  OutdatedHint,
  Panel,
  PanelHeader,
  PromptAnswer,
  PromptBox,
  PromptNote,
  PromptOption,
  PromptOptionDesc,
  PromptOptions,
  PromptOtherRow,
  PromptQuestion,
  ProviderHint,
  ProviderOption,
  ProviderValueHint,
  SelectionBar,
  SelectionClear,
  SelectionNames,
  SendButton,
  SessionText,
  SessionTitle,
  SessionWhen,
  SetupAlt,
  SetupBox,
  SetupDivider,
  SetupStep,
  ThinkingRow,
  Toolbar,
  ToolbarPill,
  ToolbarPillLabel,
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

// An interactive `ask_user` prompt rendered inline in the transcript. Single-select answers on
// click; multi-select toggles then confirms; free-text (allowOther / no options) uses the field.
function PromptBlock({
  prompt,
  onAnswer,
}: {
  prompt: AiPromptData;
  onAnswer: (answer: string) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [other, setOther] = useState('');
  const answered = prompt.answer !== undefined;
  const disabled = answered || prompt.dismissed === true;
  const showOther = prompt.allowOther || prompt.options.length === 0;

  const toggle = (label: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });

  const submitMulti = () => {
    const picks = prompt.options.filter(o => selected.has(o.label)).map(o => o.label);
    if (other.trim() !== '') picks.push(other.trim());
    if (picks.length > 0) onAnswer(picks.join(', '));
  };
  const submitOther = () => {
    if (other.trim() !== '') onAnswer(other.trim());
  };

  return (
    <PromptBox>
      <PromptQuestion>{prompt.question}</PromptQuestion>
      {answered ? (
        <PromptAnswer>{prompt.answer}</PromptAnswer>
      ) : (
        <>
          {prompt.options.length > 0 && (
            <PromptOptions>
              {prompt.options.map(o => (
                <PromptOption
                  key={o.label}
                  type="button"
                  disabled={disabled}
                  selected={prompt.multiSelect && selected.has(o.label)}
                  onClick={() => {
                    if (disabled) return;
                    if (prompt.multiSelect) toggle(o.label);
                    else onAnswer(o.label);
                  }}
                >
                  <span>{o.label}</span>
                  {o.description !== undefined && o.description !== '' && (
                    <PromptOptionDesc>{o.description}</PromptOptionDesc>
                  )}
                </PromptOption>
              ))}
            </PromptOptions>
          )}
          {showOther && (
            <PromptOtherRow>
              <TextField
                fullWidth
                multiline
                maxRows={4}
                size="small"
                placeholder={t('editor.ai.prompt.other_placeholder')}
                value={other}
                disabled={disabled}
                onChange={e => setOther(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey && !prompt.multiSelect) {
                    e.preventDefault();
                    submitOther();
                  }
                }}
              />
              {!prompt.multiSelect && (
                <SendButton
                  aria-label={t('editor.ai.send')}
                  disabled={disabled || other.trim() === ''}
                  onClick={submitOther}
                >
                  <ArrowUpwardIcon fontSize="small" />
                </SendButton>
              )}
            </PromptOtherRow>
          )}
          {prompt.multiSelect && (
            <Button
              color="primary"
              size="small"
              disabled={disabled || (selected.size === 0 && other.trim() === '')}
              onClick={submitMulti}
            >
              {t('editor.ai.prompt.confirm')}
            </Button>
          )}
          {prompt.dismissed === true && <PromptNote>{t('editor.ai.prompt.dismissed')}</PromptNote>}
        </>
      )}
    </PromptBox>
  );
}

// The pure chat surface, driven entirely by props. Both the inline panel (redux-backed)
// and the detached window (mirror-backed) render this — neither reaches into a store from
// here, so the same view works whichever owns the state (#1504).
export interface ChatViewProps {
  providers: {
    id: AiProvider;
    label: string;
    available: boolean;
    reason?: string;
    version?: string;
  }[];
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
  // Answer an interactive `ask_user` prompt (unblocks the agent's waiting tool call).
  onAnswerPrompt: (id: string, answer: string) => void;
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
    onAnswerPrompt,
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
  // Anchor for the "New Chat" dropdown (new chat + recent sessions), replacing the old
  // full-panel history view.
  const [chatMenuAnchor, setChatMenuAnchor] = useState<null | HTMLElement>(null);

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
          {msg.prompt !== undefined && (
            <PromptBlock
              prompt={msg.prompt}
              onAnswer={answer => {
                if (msg.prompt !== undefined) onAnswerPrompt(msg.prompt.id, answer);
              }}
            />
          )}
          {!msg.done && msg.text === '' && msg.error === undefined && msg.prompt === undefined && (
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
          {t('editor.ai.title')}
          {title !== undefined && title !== '' ? ` — ${title}` : ''}
        </HeaderTitle>
        <HeaderActions>
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

      <>
        <Toolbar>
          <ToolbarPill
            aria-label={t('editor.ai.new_chat')}
            onClick={e => setChatMenuAnchor(e.currentTarget)}
          >
            <AddCommentIcon fontSize="small" />
            <ToolbarPillLabel>{t('editor.ai.new_chat')}</ToolbarPillLabel>
            <KeyboardArrowDownIcon
              fontSize="small"
              sx={{ marginLeft: 'auto' }}
            />
          </ToolbarPill>
          <Menu
            anchorEl={chatMenuAnchor}
            open={chatMenuAnchor !== null}
            onClose={() => setChatMenuAnchor(null)}
          >
            <MenuItem
              disabled={busy || messages.length === 0}
              sx={{ gap: 1 }}
              onClick={() => {
                onNewChat();
                setChatMenuAnchor(null);
              }}
            >
              <AddCommentIcon fontSize="small" />
              {t('editor.ai.new_chat')}
            </MenuItem>
            {savedSessions.length > 0 && <Divider />}
            {savedSessions.map(s => (
              <MenuItem
                key={s.id}
                selected={s.id === currentSessionId}
                sx={{ gap: 1 }}
                onClick={() => {
                  onSwitchSession(s.id);
                  setChatMenuAnchor(null);
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
              </MenuItem>
            ))}
          </Menu>
          {providers.length > 1 && (
            <Select
              size="small"
              value={provider}
              onChange={handleProviderChange}
              disabled={busy}
              sx={{
                flex: 1,
                minWidth: 0,
                height: theme => theme.spacing(4),
                borderRadius: theme => theme.spacing(3),
                backgroundColor: 'action.hover',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
                '& .MuiSelect-select': { display: 'flex', alignItems: 'center' },
              }}
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
                    {!p.available && <ProviderHint>{t('editor.ai.provider_signin')}</ProviderHint>}
                  </ProviderOption>
                </MenuItem>
              ))}
            </Select>
          )}
        </Toolbar>

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

        {available &&
          currentProvider?.id === 'claude' &&
          isCliVersionOutdated(currentProvider.version, MIN_CLAUDE_CLI_VERSION) && (
            <OutdatedHint>
              <InfoOutlinedIcon fontSize="inherit" />
              <span>{t('editor.ai.outdated', { version: currentProvider.version ?? '' })}</span>
            </OutdatedHint>
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
                <SendButton
                  aria-label={t('editor.ai.send')}
                  disabled={!available || input.trim() === ''}
                  onClick={handleSend}
                >
                  <ArrowUpwardIcon fontSize="small" />
                </SendButton>
              </span>
            </Tooltip>
          )}
        </Composer>
      </>
    </Panel>
  );
}
