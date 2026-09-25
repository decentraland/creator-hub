import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import StopIcon from '@mui/icons-material/Stop';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import ViewInArOutlinedIcon from '@mui/icons-material/ViewInArOutlined';
import AudiotrackIcon from '@mui/icons-material/Audiotrack';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import AddCommentOutlinedIcon from '@mui/icons-material/AddCommentOutlined';
import CheckIcon from '@mui/icons-material/Check';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import UndoIcon from '@mui/icons-material/Undo';
import HighlightAltIcon from '@mui/icons-material/HighlightAlt';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import type { Theme } from '@mui/material/styles';
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

import type { AiAttachment, AiAttachmentKind, AiProvider } from '/shared/types/ai';
import { AI_CLI_COMMANDS, MIN_CLAUDE_CLI_VERSION, isCliVersionOutdated } from '/shared/types/ai';

import { ai as aiPreload } from '#preload';
import { t } from '/@/modules/store/translation/utils';
import { useCliSignIn } from '/@/hooks/useCliSignIn';

import type { AiMessage, AiPromptData, AiSessionMeta } from '/@/modules/store/ai/types';
import { WarningCircleIcon } from '../Icons';
import { toolChipLabel } from './labels';
import {
  AssistantBubble,
  AssistantImage,
  AssistantText,
  AttachButton,
  AttachmentBar,
  AttachmentChip,
  AttachmentName,
  AttachmentRemove,
  BillingBody,
  BillingCard,
  BillingTitle,
  CommandLine,
  Composer,
  DropHint,
  ErrorRow,
  HeaderActions,
  HeaderTitle,
  IntroMessage,
  MenuSectionLabel,
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
  SelectionNames,
  SendButton,
  SessionText,
  SessionTitle,
  SessionWhen,
  SetupAlt,
  SetupBox,
  SetupDivider,
  SetupStep,
  StopButton,
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

// Both toolbar dropdowns (the chat menu and the agent select) open below their trigger with a
// 10px gap and share the same dark rounded paper + 12px option labels (#1619). `aiMenuSx` takes
// extra paper styles so the chat menu can widen its paper on top of the shared chrome.
const AI_MENU_ORIGIN = {
  anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
  transformOrigin: { vertical: 'top', horizontal: 'left' },
} as const;

const aiMenuSx = (theme: Theme, paper?: Record<string, string | number>) => ({
  '& .MuiPaper-root': {
    backgroundColor: 'var(--ai-menu-bg)',
    borderRadius: '12px',
    marginTop: theme.spacing(1.25),
    ...paper,
  },
  '& .MuiMenuItem-root': { fontSize: theme.typography.pxToRem(12) },
});

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

// The plain-text content of a message (its text parts joined) — for the user bubble and for
// re-sending the last prompt on retry.
function messageText(msg: AiMessage): string {
  return msg.parts.map(p => (p.kind === 'text' ? p.text : '')).join('');
}

// Cap on how many files a single prompt carries (mirrors MAX_ATTACHMENTS in main/modules/ai.ts).
const MAX_ATTACHMENTS = 8;

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif'];
const MODEL_EXTS = ['glb', 'gltf'];
const AUDIO_EXTS = ['mp3', 'wav', 'ogg', 'm4a', 'flac'];

// Classify a file for its chip icon and codex's image-only -i flag. Prefers the MIME type the OS
// reported, falling back to the extension (dropped files often arrive with an empty MIME type).
function classifyAttachment(name: string, mimeType: string): AiAttachmentKind {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (mimeType.startsWith('image/') || IMAGE_EXTS.includes(ext)) return 'image';
  if (mimeType.startsWith('model/') || MODEL_EXTS.includes(ext)) return 'model';
  if (mimeType.startsWith('audio/') || AUDIO_EXTS.includes(ext)) return 'audio';
  return 'file';
}

// Turn a dropped/picked/pasted File into an attachment. A file on disk (drop or picker) resolves
// to its real path via preload — Electron hides File.path from the renderer, so main hands the
// CLI that path directly (no copy, no size limit). A pasted blob has no path, so read its bytes
// into a data URL and let main temp-file it.
async function fileToAttachment(file: File): Promise<AiAttachment | null> {
  const kind = classifyAttachment(file.name, file.type);
  const mimeType = file.type !== '' ? file.type : undefined;
  const name = file.name !== '' ? file.name : 'attachment';
  const diskPath = aiPreload.getPathForFile(file);
  if (diskPath !== '') return { name, kind, mimeType, path: diskPath };
  const dataUrl = await new Promise<string | null>(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
  return dataUrl === null ? null : { name, kind, mimeType, dataUrl };
}

// Whether a drag carries files (not a text/selection drag within the composer).
function isFileDrag(e: React.DragEvent): boolean {
  return Array.from(e.dataTransfer.types).includes('Files');
}

function AttachmentIcon({ kind }: { kind: AiAttachmentKind }) {
  switch (kind) {
    case 'image':
      return <ImageOutlinedIcon />;
    case 'model':
      return <ViewInArOutlinedIcon />;
    case 'audio':
      return <AudiotrackIcon />;
    default:
      return <InsertDriveFileOutlinedIcon />;
  }
}

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
    // False when the CLI has no scriptable login (Gemini) — hides the in-app "Sign in" button.
    managedSignIn: boolean;
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
  onSend: (text: string, attachments?: AiAttachment[]) => void;
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
  // A prompt seeded from the inspector (Trigger Area "describe a reaction"). When its nonce
  // changes the composer copies `text` into its input and calls onDraftConsumed. Inline only.
  draftPrompt?: { text: string; nonce: number } | null;
  onDraftConsumed?: () => void;
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
    draftPrompt,
    onDraftConsumed,
  } = props;

  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<AiAttachment[]>([]);
  const [dragging, setDragging] = useState(false);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Seed the composer from an inspector-supplied prompt (Trigger Area). Replaces the current
  // draft and focuses so the user can finish typing; consumes it so it fires once per click.
  useEffect(() => {
    if (!draftPrompt) return;
    setInput(draftPrompt.text);
    onDraftConsumed?.();
    requestAnimationFrame(() => {
      const el = composerRef.current;
      if (el === null) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  }, [draftPrompt?.nonce]);
  const [mcpInfo, setMcpInfo] = useState<{ url: string; token: string } | null>(null);
  const [mcpCopied, setMcpCopied] = useState(false);
  // Anchor for the "New Chat" dropdown (new chat + recent sessions), replacing the old
  // full-panel history view.
  const [chatMenuAnchor, setChatMenuAnchor] = useState<null | HTMLElement>(null);

  // Saved conversations for the history menu (the current not-yet-used session isn't listed).
  const savedSessions = useMemo(() => sessions.filter(s => s.title !== ''), [sessions]);

  // The active saved conversation, if any — its title labels the dropdown button; otherwise the
  // button reads "New chat" (#1619).
  const currentSession = useMemo(
    () => savedSessions.find(s => s.id === currentSessionId),
    [savedSessions, currentSessionId],
  );

  const currentProvider = useMemo(
    () => providers.find(p => p.id === provider),
    [providers, provider],
  );
  const available = currentProvider?.available ?? false;

  // In-app sign-in without a CLI (#1531): install the official CLI on demand + drive its
  // subscription login (browser OAuth), streaming steps here. On success we re-detect so
  // the provider flips to available.
  const {
    signIn,
    start: handleSignIn,
    cancel: handleCancelSignIn,
  } = useCliSignIn(provider, onRecheck);

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

  // Resolve dropped/picked/pasted files to attachments and append them, keeping within the cap.
  const addFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    const resolved = (await Promise.all(list.map(fileToAttachment))).filter(
      (a): a is AiAttachment => a !== null,
    );
    if (resolved.length === 0) return;
    setAttachments(prev => [...prev, ...resolved].slice(0, MAX_ATTACHMENTS));
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleSend = useCallback(() => {
    if (busy) return;
    const text = input.trim();
    if (text === '' && attachments.length === 0) return;
    onSend(text, attachments.length > 0 ? attachments : undefined);
    setInput('');
    setAttachments([]);
  }, [busy, input, attachments, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!isFileDrag(e)) return;
      // Always swallow the default: an unprevented file drop makes the window try to open the
      // file (will-navigate then blocks it, but the flash is ugly). Only signal/accept when the
      // provider is available.
      e.preventDefault();
      e.dataTransfer.dropEffect = available ? 'copy' : 'none';
      if (available) setDragging(true);
    },
    [available],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Ignore leaves into a child element — only clear when the pointer exits the composer.
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      setDragging(false);
      if (available && e.dataTransfer.files.length > 0) void addFiles(e.dataTransfer.files);
    },
    [available, addFiles],
  );

  // Pasting an image from the clipboard attaches it (it has no disk path, so it rides as a data URL).
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (!available || e.clipboardData.files.length === 0) return;
      e.preventDefault();
      void addFiles(e.clipboardData.files);
    },
    [available, addFiles],
  );

  const handleFilePick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files !== null) void addFiles(e.target.files);
      e.target.value = ''; // reset so the same file can be picked again
    },
    [addFiles],
  );

  const handleProviderChange = useCallback(
    (e: SelectChangeEvent) => onProviderChange(e.target.value as AiProvider),
    [onProviderChange],
  );

  const renderSetup = () => {
    const cmds = AI_CLI_COMMANDS[provider];
    return (
      <SetupBox>
        <strong>{t('editor.ai.setup.title')}</strong>
        <span>{t('editor.ai.setup.description')}</span>
        {/* Primary path (#1531): sign in with the subscription in-app — installs the
            official CLI on demand and drives its browser OAuth. No terminal needed. Hidden for a
            provider whose CLI has no scriptable login (Gemini): only the terminal path applies. */}
        {currentProvider?.managedSignIn === true && (
          <>
            <Button
              color="primary"
              size="small"
              disabled={signIn.busy}
              startIcon={signIn.busy ? <CircularProgress size={16} /> : undefined}
              onClick={handleSignIn}
            >
              {t('editor.ai.setup.signin_button', {
                provider: currentProvider?.label ?? provider,
              })}
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
          </>
        )}
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
    // "Undo AI changes" is offered only on the latest turn: undo is a shared stack, so an
    // older turn's entries aren't on top and can't be cleanly reverted in isolation.
    const lastId = messages[messages.length - 1]?.id;
    const transcript = messages.map(msg =>
      msg.role === 'user' ? (
        <UserBubble key={msg.id}>
          {messageText(msg)}
          {msg.attachments !== undefined && msg.attachments.length > 0 && (
            <AttachmentBar sx={{ mt: messageText(msg) !== '' ? 0.75 : 0, mb: 0 }}>
              {msg.attachments.map((att, i) => (
                <AttachmentChip key={`${att.name}-${i}`}>
                  <AttachmentIcon kind={att.kind} />
                  <AttachmentName title={att.name}>{att.name}</AttachmentName>
                </AttachmentChip>
              ))}
            </AttachmentBar>
          )}
        </UserBubble>
      ) : (
        <AssistantBubble key={msg.id}>
          {msg.parts.map((part, i) => {
            switch (part.kind) {
              case 'text':
                return (
                  <AssistantText key={i}>
                    <Markdown options={MARKDOWN_OPTIONS}>{part.text}</Markdown>
                  </AssistantText>
                );
              case 'tool':
                return (
                  <ToolChip key={i}>
                    <span>{toolChipLabel(part.tool)}</span>
                    {part.detail !== '' && <ToolDetail>{part.detail}</ToolDetail>}
                  </ToolChip>
                );
              case 'image':
                return (
                  <AssistantImage
                    key={i}
                    src={part.dataUrl}
                    alt={t('editor.ai.screenshot_alt')}
                  />
                );
              case 'prompt':
                return (
                  <PromptBlock
                    key={i}
                    prompt={part.prompt}
                    onAnswer={answer => onAnswerPrompt(part.prompt.id, answer)}
                  />
                );
              default: {
                // Exhaustiveness: a new AiPart variant fails to compile until handled here.
                const _exhaustive: never = part;
                return _exhaustive;
              }
            }
          })}
          {!msg.done && msg.parts.length === 0 && msg.error === undefined && (
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
                    if (lastUser !== undefined) onSend(messageText(lastUser));
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
    return (
      <>
        <IntroMessage>{t('editor.ai.empty')}</IntroMessage>
        {transcript}
      </>
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
          <Tooltip title={t('editor.ai.close')}>
            <IconButton
              size="small"
              aria-label={t('editor.ai.close')}
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
            open={chatMenuAnchor !== null}
            aria-label={t('editor.ai.new_chat')}
            aria-haspopup="menu"
            aria-expanded={chatMenuAnchor !== null}
            onClick={e => setChatMenuAnchor(e.currentTarget)}
          >
            <AddCommentOutlinedIcon sx={{ fontSize: 16 }} />
            <ToolbarPillLabel>
              {currentSession !== undefined ? currentSession.title : t('editor.ai.new_chat')}
            </ToolbarPillLabel>
            <KeyboardArrowDownIcon
              fontSize="small"
              sx={{ marginLeft: 'auto' }}
            />
          </ToolbarPill>
          <Menu
            anchorEl={chatMenuAnchor}
            open={chatMenuAnchor !== null}
            onClose={() => setChatMenuAnchor(null)}
            {...AI_MENU_ORIGIN}
            sx={theme => ({
              ...aiMenuSx(theme, { width: '300px' }),
              '& .MuiMenuItem-root.Mui-selected, & .MuiMenuItem-root.Mui-selected:hover': {
                backgroundColor: 'var(--ai-session-selected)',
              },
            })}
          >
            <MenuItem
              disabled={busy || messages.length === 0}
              sx={{ gap: 1, mx: 1, my: 0.5, borderRadius: 1 }}
              onClick={() => {
                onNewChat();
                setChatMenuAnchor(null);
              }}
            >
              <AddCommentOutlinedIcon sx={{ fontSize: 16 }} />
              {t('editor.ai.new_chat')}
            </MenuItem>
            {savedSessions.length > 0 && [
              <Divider key="div" />,
              <MenuSectionLabel key="label">{t('editor.ai.history.title')}</MenuSectionLabel>,
            ]}
            {savedSessions.map(s => (
              <MenuItem
                key={s.id}
                selected={s.id === currentSessionId}
                sx={{ gap: 1, mx: 1, my: 0.5, borderRadius: 1 }}
                onClick={() => {
                  onSwitchSession(s.id);
                  setChatMenuAnchor(null);
                }}
              >
                <CheckIcon
                  sx={{
                    fontSize: 16,
                    visibility: s.id === currentSessionId ? 'visible' : 'hidden',
                  }}
                />
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
              IconComponent={KeyboardArrowDownIcon}
              MenuProps={{
                ...AI_MENU_ORIGIN,
                sx: theme => ({
                  ...aiMenuSx(theme),
                  '& .MuiMenuItem-root.Mui-selected': {
                    backgroundColor: 'var(--ai-selected)',
                  },
                  '& .MuiMenuItem-root.Mui-selected:hover': {
                    backgroundColor: 'var(--ai-selected-hover)',
                  },
                }),
              }}
              sx={{
                flex: 1,
                minWidth: 0,
                height: theme => theme.spacing(3.75),
                borderRadius: theme => theme.spacing(1),
                backgroundColor: 'var(--ai-menu-bg)',
                fontSize: theme => theme.typography.pxToRem(12),
                // Outline only on hover / while open, transparent at rest — matches the New Chat
                // pill (#1619).
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'text.secondary' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'text.secondary' },
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
                  sx={{ gap: 1, mx: 1, my: 0.5, borderRadius: 1 }}
                >
                  <CheckIcon
                    fontSize="small"
                    sx={{ visibility: p.id === provider ? 'visible' : 'hidden' }}
                  />
                  <ProviderOption>
                    <span>{p.label}</span>
                    {!p.available && (
                      <ProviderHint>{p.reason ?? t('editor.ai.provider_signin')}</ProviderHint>
                    )}
                  </ProviderOption>
                </MenuItem>
              ))}
            </Select>
          )}
        </Toolbar>

        <Transcript ref={transcriptRef}>
          {available ? renderTranscript() : renderSetup()}
        </Transcript>

        {available &&
          currentProvider?.id === 'claude' &&
          isCliVersionOutdated(currentProvider.version, MIN_CLAUDE_CLI_VERSION) && (
            <OutdatedHint>
              <WarningCircleIcon size={28} />
              <span>{t('editor.ai.outdated', { version: currentProvider.version ?? '' })}</span>
            </OutdatedHint>
          )}

        {available && !billingDismissed && (
          <BillingCard>
            <BillingTitle>{t('editor.ai.billing_title')}</BillingTitle>
            <BillingBody>{t('editor.ai.billing')}</BillingBody>
            <Button
              color="secondary"
              variant="text"
              size="small"
              onClick={onDismissBilling}
              sx={{
                backgroundColor: 'var(--dark-gray)',
                borderRadius: theme => theme.spacing(1),
                paddingLeft: theme => theme.spacing(2.5),
                paddingRight: theme => theme.spacing(2.5),
                '&:hover': { backgroundColor: 'var(--light-gray)' },
                // ui2 pins secondary-text buttons' color AND textTransform (forced uppercase) at
                // 0,6,0 specificity; out-specify both here (repeated & = 0,7,0) so the label stays
                // white and reads as "Got It" rather than "GOT IT".
                '&&&&&&&': { color: 'var(--white)', textTransform: 'none' },
              }}
            >
              {t('editor.ai.billing_dismiss')}
            </Button>
          </BillingCard>
        )}

        {available && selection.length > 0 && (
          <SelectionBar>
            <HighlightAltIcon fontSize="small" />
            <SelectionNames>
              {t('editor.ai.selection', {
                names: selection.map(s => (s.name !== '' ? s.name : `#${s.id}`)).join(', '),
              })}
            </SelectionNames>
            <Tooltip title={t('editor.ai.selection_clear')}>
              <IconButton
                size="small"
                aria-label={t('editor.ai.selection_clear')}
                onClick={onClearSelection}
                sx={{
                  flexShrink: 0,
                  padding: 0.25,
                  color: 'text.primary',
                  backgroundColor: 'action.hover',
                  '&:hover': { backgroundColor: 'action.selected' },
                }}
              >
                <CloseIcon sx={{ fontSize: 13 }} />
              </IconButton>
            </Tooltip>
          </SelectionBar>
        )}

        <Composer
          dragging={dragging}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {dragging && (
            <DropHint>
              <AttachFileIcon fontSize="small" />
              {t('editor.ai.attach.drop_hint')}
            </DropHint>
          )}
          {attachments.length > 0 && (
            <AttachmentBar>
              {attachments.map((att, i) => (
                <AttachmentChip key={`${att.name}-${i}`}>
                  <AttachmentIcon kind={att.kind} />
                  <AttachmentName title={att.name}>{att.name}</AttachmentName>
                  <Tooltip title={t('editor.ai.attach.remove')}>
                    <AttachmentRemove
                      aria-label={t('editor.ai.attach.remove')}
                      onClick={() => removeAttachment(i)}
                    >
                      <CloseIcon />
                    </AttachmentRemove>
                  </Tooltip>
                </AttachmentChip>
              ))}
            </AttachmentBar>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={handleFilePick}
          />
          <TextField
            fullWidth
            multiline
            maxRows={6}
            size="small"
            autoFocus
            inputRef={composerRef}
            placeholder={t('editor.ai.placeholder')}
            value={input}
            disabled={!available}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            sx={{
              // Rounded field with the send control living inside it; a white focus/hover
              // outline instead of the default primary (ruby) ring (#1576).
              '& .MuiOutlinedInput-root': {
                borderRadius: '10px',
                alignItems: 'center',
                paddingRight: theme => theme.spacing(0.75),
                backgroundColor: 'var(--ai-input-bg)',
              },
              '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: 'text.secondary',
              },
              '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: 'secondary.main',
              },
            }}
            InputProps={{
              startAdornment: (
                <Tooltip title={t('editor.ai.attach.button')}>
                  <span>
                    <AttachButton
                      aria-label={t('editor.ai.attach.button')}
                      disabled={!available || attachments.length >= MAX_ATTACHMENTS}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <AttachFileIcon fontSize="small" />
                    </AttachButton>
                  </span>
                </Tooltip>
              ),
              endAdornment: busy ? (
                <Tooltip title={t('editor.ai.stop')}>
                  <StopButton
                    aria-label={t('editor.ai.stop')}
                    onClick={onStop}
                  >
                    <StopIcon fontSize="small" />
                  </StopButton>
                </Tooltip>
              ) : (
                <Tooltip title={t('editor.ai.send')}>
                  <span>
                    <SendButton
                      aria-label={t('editor.ai.send')}
                      disabled={!available || (input.trim() === '' && attachments.length === 0)}
                      onClick={handleSend}
                    >
                      <ArrowUpwardIcon fontSize="small" />
                    </SendButton>
                  </span>
                </Tooltip>
              ),
            }}
          />
        </Composer>
      </>
    </Panel>
  );
}
