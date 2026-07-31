import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import BuildIcon from '@mui/icons-material/Build';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import KeyIcon from '@mui/icons-material/Key';
import RefreshIcon from '@mui/icons-material/Refresh';
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
  AuthInstructions,
  ErrorLine,
  InputArea,
  Messages,
  Panel,
  PanelHeader,
  ProviderRow,
  Setup,
  SetupDivider,
  StatusLine,
  ToolLine,
  UserBubble,
} from './component.styled';

import type { AiAuthProvider } from '/shared/types/ipc';
import type { ChatItem } from './chat';

type Props = {
  projectPath: string;
  onClose: () => void;
  onSceneChanged?: () => void;
};

const AI_AUTH_PROVIDERS: AiAuthProvider[] = ['anthropic', 'openai-codex', 'github-copilot'];

type LoginState = {
  provider: AiAuthProvider | null;
  message?: string;
  url?: string;
  instructions?: string;
  prompt?: { id: number; message: string; placeholder?: string };
};

const IDLE_LOGIN_STATE: LoginState = { provider: null };

function getProviderName(provider: AiAuthProvider): string {
  switch (provider) {
    case 'anthropic':
      return t('editor.ai_assistant.setup.provider_anthropic');
    case 'openai-codex':
      return t('editor.ai_assistant.setup.provider_openai_codex');
    case 'github-copilot':
      return t('editor.ai_assistant.setup.provider_github_copilot');
  }
}

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
    case 'scene_reloaded':
      return (
        <StatusLine key={index}>
          <RefreshIcon fontSize="inherit" />
          {t('editor.ai_assistant.scene_reloaded')}
        </StatusLine>
      );
  }
}

export function AiAssistant({ projectPath, onClose, onSceneChanged }: Props) {
  const dispatch = useDispatch();
  const { settings } = useSettings();
  const [view, setView] = useState<'loading' | 'setup' | 'chat'>('loading');
  const [apiKey, setApiKey] = useState('');
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const [oauthProviders, setOauthProviders] = useState<AiAuthProvider[]>([]);
  const [loginState, setLoginState] = useState<LoginState>(IDLE_LOGIN_STATE);
  const [promptValue, setPromptValue] = useState('');
  const [setupError, setSetupError] = useState<string | null>(null);
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
        setHasExistingKey(agentState.hasApiKey);
        setOauthProviders(agentState.oauthProviders);
        if (agentState.hasApiKey || agentState.oauthProviders.length > 0) {
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

  // Once the agent finishes a turn that modified files, reload the inspector so
  // the changes become visible (the inspector only reads the scene from disk on boot)
  useEffect(() => {
    if (!state.busy && state.filesChanged && onSceneChanged) {
      onSceneChanged();
      dispatchChat({ type: 'scene_reloaded' });
    }
  }, [state.busy, state.filesChanged, onSceneChanged]);

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
    setSetupError(null);
    setView('setup');
  }, []);

  const handleCancelSetup = useCallback(() => {
    setApiKey('');
    setSetupError(null);
    setView('chat');
  }, []);

  const handleLogin = useCallback(
    async (provider: AiAuthProvider) => {
      setSetupError(null);
      setPromptValue('');
      setLoginState({ provider });
      try {
        await ai.loginAiProvider(provider, event => {
          setLoginState(current => {
            if (current.provider !== provider) return current;
            switch (event.type) {
              case 'auth':
                return { ...current, url: event.url, instructions: event.instructions };
              case 'progress':
                return { ...current, message: event.message };
              case 'prompt':
                return {
                  ...current,
                  prompt: { id: event.id, message: event.message, placeholder: event.placeholder },
                };
            }
          });
        });
        setOauthProviders(current =>
          current.includes(provider) ? current : [...current, provider],
        );
        // The agent process keeps the credentials it was spawned with — restart it
        await ai.stopAiAgent(projectPath);
        await subscribe();
        dispatchChat({ type: 'reset' });
      } catch (error) {
        setSetupError(getErrorMessage(error));
      } finally {
        setLoginState(IDLE_LOGIN_STATE);
        setPromptValue('');
      }
    },
    [projectPath, subscribe],
  );

  const handleCancelLogin = useCallback(() => {
    void ai.cancelAiLogin().catch(error => setSetupError(getErrorMessage(error)));
  }, []);

  const handlePromptSubmit = useCallback(() => {
    const prompt = loginState.prompt;
    const value = promptValue.trim();
    if (!prompt || !value) return;
    setPromptValue('');
    setLoginState(current => ({ ...current, prompt: undefined }));
    void ai.respondAiLoginPrompt(prompt.id, value).catch(error => {
      setSetupError(getErrorMessage(error));
    });
  }, [loginState.prompt, promptValue]);

  const handleLogout = useCallback(async (provider: AiAuthProvider) => {
    setSetupError(null);
    try {
      await ai.logoutAiProvider(provider);
      setOauthProviders(current => current.filter($ => $ !== provider));
    } catch (error) {
      setSetupError(getErrorMessage(error));
    }
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
          {loginState.provider === null ? (
            <>
              {oauthProviders.map(provider => (
                <ProviderRow key={provider}>
                  <CheckIcon
                    fontSize="small"
                    color="success"
                  />
                  <Typography
                    variant="body2"
                    sx={{ flex: 1 }}
                  >
                    {t('editor.ai_assistant.setup.signed_in', {
                      provider: getProviderName(provider),
                    })}
                  </Typography>
                  <Button
                    variant="text"
                    size="small"
                    onClick={() => void handleLogout(provider)}
                  >
                    {t('editor.ai_assistant.setup.sign_out')}
                  </Button>
                </ProviderRow>
              ))}
              {AI_AUTH_PROVIDERS.filter(provider => !oauthProviders.includes(provider)).map(
                provider => (
                  <Button
                    key={provider}
                    variant="outlined"
                    onClick={() => void handleLogin(provider)}
                  >
                    {t('editor.ai_assistant.setup.sign_in_with', {
                      provider: getProviderName(provider),
                    })}
                  </Button>
                ),
              )}
              <SetupDivider>{t('editor.ai_assistant.setup.or_api_key')}</SetupDivider>
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
              {(hasExistingKey || oauthProviders.length > 0) && (
                <Button
                  variant="text"
                  disabled={isSaving}
                  onClick={handleCancelSetup}
                >
                  {t('editor.ai_assistant.setup.cancel')}
                </Button>
              )}
            </>
          ) : (
            <>
              <StatusLine>
                <Loader size={12} />
                {loginState.message ?? t('editor.ai_assistant.setup.waiting')}
              </StatusLine>
              {(loginState.instructions || loginState.url) && (
                <AuthInstructions>
                  {[loginState.instructions, loginState.url].filter(Boolean).join('\n')}
                </AuthInstructions>
              )}
              {loginState.prompt && (
                <>
                  <Typography variant="body2">{loginState.prompt.message}</Typography>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder={loginState.prompt.placeholder}
                    value={promptValue}
                    onChange={event => setPromptValue(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        handlePromptSubmit();
                      }
                    }}
                  />
                  <Button
                    variant="contained"
                    disabled={!promptValue.trim()}
                    onClick={handlePromptSubmit}
                  >
                    {t('editor.ai_assistant.setup.prompt_submit')}
                  </Button>
                </>
              )}
              <Button
                variant="text"
                onClick={handleCancelLogin}
              >
                {t('editor.ai_assistant.setup.cancel_sign_in')}
              </Button>
            </>
          )}
          {setupError && (
            <ErrorLine>{t('editor.ai_assistant.error', { error: setupError })}</ErrorLine>
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
