import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import SendIcon from '@mui/icons-material/Send';
import StopIcon from '@mui/icons-material/Stop';
import AddCommentIcon from '@mui/icons-material/AddComment';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import UndoIcon from '@mui/icons-material/Undo';
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
import { useDispatch, useSelector } from '#store';
import { actions as aiActions } from '/@/modules/store/ai';
import { t } from '/@/modules/store/translation/utils';

import {
  AssistantBubble,
  AssistantText,
  CommandLine,
  Composer,
  EmptyState,
  ErrorRow,
  HeaderActions,
  HeaderTitle,
  Panel,
  PanelHeader,
  ProviderRow,
  SetupBox,
  SetupStep,
  ThinkingRow,
  ToolChip,
  ToolDetail,
  Transcript,
  UserBubble,
} from './component.styled';

// Verb shown for a tool chip, keyed by the CLI's tool name. Reads collapse to a plain
// verb; unknown tools fall back to the raw name.
const TOOL_VERBS: Record<string, string> = {
  Read: 'Read',
  Edit: 'Edited',
  Write: 'Created',
  Bash: 'Ran',
  Run: 'Ran',
  Grep: 'Searched',
  Glob: 'Searched',
  WebSearch: 'Searched',
  WebFetch: 'Fetched',
  Task: 'Task',
};

// Install + sign-in commands per provider, shown on the setup card when the CLI isn't
// found. Obviously-safe public package names.
const SETUP_COMMANDS: Record<AiProvider, { install: string; signin: string }> = {
  claude: { install: 'npm i -g @anthropic-ai/claude-code', signin: 'claude' },
  codex: { install: 'npm i -g @openai/codex', signin: 'codex login' },
};

interface Props {
  onClose: () => void;
}

export function AiChatPanel({ onClose }: Props) {
  const dispatch = useDispatch();
  const { providers, provider, messages, busy, detecting } = useSelector(state => state.ai);
  const [input, setInput] = useState('');
  const transcriptRef = useRef<HTMLDivElement>(null);

  // Detect installed CLIs on mount, and subscribe to the turn event stream for the
  // panel's lifetime — folding each event into the transcript.
  useEffect(() => {
    dispatch(aiActions.fetchProviders());
    const { cleanup } = aiPreload.subscribeAiStream(event => {
      dispatch(aiActions.applyEvent(event));
    });
    return cleanup;
  }, [dispatch]);

  // Keep the newest message in view as text streams in.
  useEffect(() => {
    const el = transcriptRef.current;
    if (el !== null) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const currentProvider = useMemo(
    () => providers.find(p => p.id === provider),
    [providers, provider],
  );
  const available = currentProvider?.available ?? false;

  const handleSend = useCallback(() => {
    if (busy || input.trim() === '') return;
    dispatch(aiActions.send(input));
    setInput('');
  }, [busy, input, dispatch]);

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
    (e: SelectChangeEvent) => {
      dispatch(aiActions.setProvider(e.target.value as AiProvider));
    },
    [dispatch],
  );

  const renderSetup = () => {
    const cmds = SETUP_COMMANDS[provider];
    return (
      <SetupBox>
        <strong>{t('editor.ai.setup.title')}</strong>
        <span>{t('editor.ai.setup.description')}</span>
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
          onClick={() => dispatch(aiActions.fetchProviders())}
        >
          {t('editor.ai.setup.recheck')}
        </Button>
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
              <span>{TOOL_VERBS[chip.tool] ?? chip.tool}</span>
              {chip.detail !== '' && <ToolDetail>{chip.detail}</ToolDetail>}
            </ToolChip>
          ))}
          {msg.text !== '' && <AssistantText>{msg.text}</AssistantText>}
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
                    if (lastUser !== undefined) dispatch(aiActions.send(lastUser.text));
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
                onClick={() =>
                  dispatch(aiActions.revertTurn({ id: msg.id, count: msg.mutations ?? 0 }))
                }
              >
                {t('editor.ai.revert')}
              </Button>
            )}
        </AssistantBubble>
      ),
    );
  };

  return (
    <Panel aria-label="ai-chat-panel">
      <PanelHeader>
        <HeaderTitle>
          <SmartToyIcon fontSize="small" />
          {t('editor.ai.title')}
        </HeaderTitle>
        <HeaderActions>
          <Tooltip title={t('editor.ai.new_chat')}>
            <span>
              <IconButton
                size="small"
                aria-label={t('editor.ai.new_chat')}
                disabled={busy || messages.length === 0}
                onClick={() => dispatch(aiActions.newChat())}
              >
                <AddCommentIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={t('editor.ai.toggle')}>
            <IconButton
              size="small"
              aria-label={t('editor.ai.toggle')}
              onClick={onClose}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </HeaderActions>
      </PanelHeader>

      {providers.length > 1 && (
        <ProviderRow>
          <Select
            size="small"
            fullWidth
            value={provider}
            onChange={handleProviderChange}
            disabled={busy}
          >
            {providers.map(p => (
              <MenuItem
                key={p.id}
                value={p.id}
                disabled={!p.available}
              >
                {p.label}
                {!p.available ? ` — ${p.reason ?? 'not installed'}` : ''}
              </MenuItem>
            ))}
          </Select>
        </ProviderRow>
      )}

      <Transcript ref={transcriptRef}>{available ? renderTranscript() : renderSetup()}</Transcript>

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
              onClick={() => dispatch(aiActions.stop())}
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
    </Panel>
  );
}
