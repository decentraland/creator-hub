import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import BuildIcon from '@mui/icons-material/Build';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import KeyIcon from '@mui/icons-material/Key';
import SendIcon from '@mui/icons-material/Send';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import {
  Button,
  CircularProgress as Loader,
  IconButton,
  TextField,
  Typography,
} from 'decentraland-ui2';

import { ai } from '#preload';
import { useDispatch } from '#store';

import { t } from '/@/modules/store/translation/utils';
import { actions as workspaceActions } from '/@/modules/store/workspace';
import { useSettings } from '/@/hooks/useSettings';

import { chatReducer, INITIAL_CHAT_STATE } from './chat';
import {
  AssistantText,
  ErrorLine,
  InputArea,
  Messages,
  Panel,
  PanelHeader,
  Setup,
  StatusLine,
  ToolLine,
  UserBubble,
} from './component.styled';

import type { ChatItem } from './chat';

type Props = {
  projectPath: string;
  onClose: () => void;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function renderChatItem(item: ChatItem, index: number) {
  switch (item.kind) {
    case 'user':
      return <UserBubble key={index}>{item.text}</UserBubble>;
    case 'assistant':
      return <AssistantText key={index}>{item.text}</AssistantText>;
    case 'tool':
      return (
        <ToolLine key={index}>
          {item.status === 'running' ? (
            <Loader size={12} />
          ) : item.status === 'error' ? (
            <ErrorOutlineIcon fontSize="inherit" />
          ) : (
            <CheckIcon fontSize="inherit" />
          )}
          <BuildIcon fontSize="inherit" />
          {item.label}
        </ToolLine>
      );
    case 'status':
      return <StatusLine key={index}>{item.text}</StatusLine>;
    case 'retry':
      return (
        <StatusLine key={index}>
          {t('editor.ai_assistant.retrying', {
            attempt: item.attempt,
            maxAttempts: item.maxAttempts,
          })}
        </StatusLine>
      );
    case 'compaction':
      return <StatusLine key={index}>{t('editor.ai_assistant.compacting')}</StatusLine>;
    case 'exit':
      return (
        <ErrorLine key={index}>
          {t('editor.ai_assistant.exited', { code: item.code ?? 'unknown' })}
        </ErrorLine>
      );
    case 'error':
      return (
        <ErrorLine key={index}>{t('editor.ai_assistant.error', { error: item.text })}</ErrorLine>
      );
  }
}

export function AiAssistant({ projectPath, onClose }: Props) {
  const dispatch = useDispatch();
  const { settings } = useSettings();
  const [view, setView] = useState<'loading' | 'setup' | 'chat'>('loading');
  const [apiKey, setApiKey] = useState('');
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [input, setInput] = useState('');
  const [state, dispatchChat] = useReducer(chatReducer, INITIAL_CHAT_STATE);
  const messagesRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const subscribe = useCallback(async () => {
    try {
      const { cleanup } = await ai.subscribeAiEvents(projectPath, event => {
        dispatchChat({ type: 'event', event, projectPath });
      });
      cleanupRef.current = cleanup;
      setView('chat');
    } catch (error) {
      dispatchChat({ type: 'error', text: getErrorMessage(error) });
      setView('chat');
    }
  }, [projectPath]);

  useEffect(() => {
    let disposed = false;
    void ai
      .getAiAgentState(projectPath)
      .then(async agentState => {
        if (disposed) return;
        if (agentState.hasApiKey) {
          setHasExistingKey(true);
          await subscribe();
        } else {
          setView('setup');
        }
      })
      .catch(error => {
        if (disposed) return;
        dispatchChat({ type: 'error', text: getErrorMessage(error) });
        setView('chat');
      });

    return () => {
      disposed = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [projectPath, subscribe]);

  useEffect(() => {
    const el = messagesRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [state.items, state.busy]);

  const handleSaveApiKey = useCallback(async () => {
    const key = apiKey.trim();
    if (!key || isSaving) return;
    setIsSaving(true);
    try {
      await dispatch(
        workspaceActions.updateSettings({
          ...settings,
          aiAgent: { ...settings.aiAgent, anthropicApiKey: key },
        }),
      ).unwrap();
      // The agent process keeps the key it was spawned with — restart it so the new key applies
      await ai.stopAiAgent(projectPath);
      await subscribe();
      dispatchChat({ type: 'reset' });
      setHasExistingKey(true);
      setApiKey('');
    } catch (error) {
      dispatchChat({ type: 'error', text: getErrorMessage(error) });
      setView('chat');
    } finally {
      setIsSaving(false);
    }
  }, [apiKey, isSaving, settings, dispatch, subscribe, projectPath]);

  const handleChangeApiKey = useCallback(() => {
    setApiKey('');
    setView('setup');
  }, []);

  const handleCancelSetup = useCallback(() => {
    setApiKey('');
    setView('chat');
  }, []);

  const handleSend = useCallback(async () => {
    const message = input.trim();
    if (!message || state.busy || state.exited) return;
    setInput('');
    dispatchChat({ type: 'prompt', text: message });
    try {
      await ai.sendAiPrompt(projectPath, message);
    } catch (error) {
      dispatchChat({ type: 'error', text: getErrorMessage(error) });
    }
  }, [input, state.busy, state.exited, projectPath]);

  const handleAbort = useCallback(() => {
    void ai.abortAi(projectPath).catch(error => {
      dispatchChat({ type: 'error', text: getErrorMessage(error) });
    });
  }, [projectPath]);

  const handleInputKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        void handleSend();
      }
    },
    [handleSend],
  );

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      void handleSend();
    },
    [handleSend],
  );

  return (
    <Panel>
      <PanelHeader>
        <Typography variant="subtitle1">{t('editor.ai_assistant.title')}</Typography>
        {view === 'chat' && (
          <IconButton
            size="small"
            onClick={handleChangeApiKey}
            aria-label={t('editor.ai_assistant.change_api_key')}
          >
            <KeyIcon fontSize="small" />
          </IconButton>
        )}
        <IconButton
          size="small"
          onClick={onClose}
          aria-label={t('editor.ai_assistant.close')}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </PanelHeader>
      {view === 'loading' && (
        <StatusLine sx={{ padding: 2 }}>
          <Loader size={12} />
          {t('editor.ai_assistant.starting')}
        </StatusLine>
      )}
      {view === 'setup' && (
        <Setup>
          <Typography variant="body2">{t('editor.ai_assistant.setup.description')}</Typography>
          <TextField
            type="password"
            size="small"
            label={t('editor.ai_assistant.setup.api_key_label')}
            value={apiKey}
            onChange={event => setApiKey(event.target.value)}
            fullWidth
          />
          <Button
            variant="contained"
            disabled={!apiKey.trim() || isSaving}
            onClick={handleSaveApiKey}
            startIcon={isSaving ? <Loader size={16} /> : undefined}
          >
            {t('editor.ai_assistant.setup.save')}
          </Button>
          {hasExistingKey && (
            <Button
              variant="text"
              disabled={isSaving}
              onClick={handleCancelSetup}
            >
              {t('editor.ai_assistant.setup.cancel')}
            </Button>
          )}
        </Setup>
      )}
      {view === 'chat' && (
        <>
          <Messages ref={messagesRef}>
            {state.items.length === 0 && !state.busy && (
              <StatusLine>{t('editor.ai_assistant.empty')}</StatusLine>
            )}
            {state.items.map(renderChatItem)}
            {state.busy && (
              <StatusLine>
                <Loader size={12} />
                {t('editor.ai_assistant.working')}
              </StatusLine>
            )}
          </Messages>
          <InputArea onSubmit={handleSubmit}>
            <TextField
              multiline
              maxRows={5}
              size="small"
              fullWidth
              placeholder={t('editor.ai_assistant.input_placeholder')}
              value={input}
              onChange={event => setInput(event.target.value)}
              onKeyDown={handleInputKeyDown}
              disabled={state.busy || state.exited}
            />
            {state.busy ? (
              <IconButton
                color="error"
                onClick={handleAbort}
                aria-label={t('editor.ai_assistant.stop')}
              >
                <StopCircleIcon />
              </IconButton>
            ) : (
              <IconButton
                color="primary"
                type="submit"
                disabled={!input.trim() || state.exited}
                aria-label={t('editor.ai_assistant.send')}
              >
                <SendIcon />
              </IconButton>
            )}
          </InputArea>
        </>
      )}
    </Panel>
  );
}
