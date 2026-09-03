import { useCallback, useEffect, useState } from 'react';
import { Box, CircularProgress } from 'decentraland-ui2';

import type { AiMirrorState, AiProvider } from '/shared/types/ai';

import { ai as aiPreload } from '#preload';
import { useDispatch } from '#store';
import { actions as translationActions } from '/@/modules/store/translation';
import { locales } from '/@/modules/store/translation/utils';
import type { Locale } from '/shared/types/translation';

import type { AiMessage } from '/@/modules/store/ai/types';
import { ChatView } from '../AiChatPanel/ChatView';

// The detached chat window (#1504). It keeps no chat store of its own: it renders the
// state the main window mirrors here and sends the user's actions back as remote commands
// (both relayed through main). The surrounding StoreProvider exists only for i18n/theme —
// the `ai` slice is never read here.
export function AiChatWindow() {
  const dispatch = useDispatch();
  const [mirror, setMirror] = useState<AiMirrorState | null>(null);

  // Match the app's locale (passed on the window URL) so the chrome isn't stuck on English.
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('locale');
    // Runtime-checked against the actual locale list, so a new locale needs no change here.
    if (raw !== null && (locales as string[]).includes(raw)) {
      dispatch(translationActions.changeLocale(raw as Locale));
    }
  }, [dispatch]);

  // Receive mirrored state, and ask the main window to push the current state on mount.
  useEffect(() => {
    const { cleanup } = aiPreload.onAiMirrorState(setMirror);
    aiPreload.sendAiRemoteCommand({ type: 'sync' });
    return cleanup;
  }, []);

  const onSend = useCallback(
    (text: string) => aiPreload.sendAiRemoteCommand({ type: 'send', text }),
    [],
  );
  const onStop = useCallback(() => aiPreload.sendAiRemoteCommand({ type: 'stop' }), []);
  const onNewChat = useCallback(() => aiPreload.sendAiRemoteCommand({ type: 'newChat' }), []);
  const onProviderChange = useCallback(
    (provider: AiProvider) => aiPreload.sendAiRemoteCommand({ type: 'setProvider', provider }),
    [],
  );
  const onAnswerPrompt = useCallback(
    (id: string, answer: string) =>
      aiPreload.sendAiRemoteCommand({ type: 'answerPrompt', id, answer }),
    [],
  );
  const onRevertTurn = useCallback(
    (id: string, count: number) => aiPreload.sendAiRemoteCommand({ type: 'revertTurn', id, count }),
    [],
  );
  const onRecheck = useCallback(
    () => aiPreload.sendAiRemoteCommand({ type: 'fetchProviders' }),
    [],
  );
  const onDismissBilling = useCallback(
    () => aiPreload.sendAiRemoteCommand({ type: 'dismissBilling' }),
    [],
  );
  const onSwitchSession = useCallback(
    (id: string) => aiPreload.sendAiRemoteCommand({ type: 'switchSession', id }),
    [],
  );
  const onDeleteSession = useCallback(
    (id: string) => aiPreload.sendAiRemoteCommand({ type: 'deleteSession', id }),
    [],
  );
  const onClearSelection = useCallback(
    () => aiPreload.sendAiRemoteCommand({ type: 'clearSelection' }),
    [],
  );
  // Closing the detached window docks the chat back inline.
  const onClose = useCallback(() => void aiPreload.closeAiWindow(), []);

  if (mirror === null) {
    return (
      <Box
        sx={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <ChatView
      detached
      providers={mirror.providers}
      provider={mirror.provider}
      messages={mirror.messages as AiMessage[]}
      busy={mirror.busy}
      detecting={mirror.detecting}
      selection={mirror.selection}
      billingDismissed={mirror.billingDismissed}
      sessions={mirror.sessions}
      currentSessionId={mirror.currentSessionId}
      title={mirror.projectTitle}
      onSend={onSend}
      onStop={onStop}
      onNewChat={onNewChat}
      onProviderChange={onProviderChange}
      onRevertTurn={onRevertTurn}
      onAnswerPrompt={onAnswerPrompt}
      onRecheck={onRecheck}
      onDismissBilling={onDismissBilling}
      onSwitchSession={onSwitchSession}
      onDeleteSession={onDeleteSession}
      onClearSelection={onClearSelection}
      onClose={onClose}
    />
  );
}
