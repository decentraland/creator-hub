import { useCallback } from 'react';

import type { AiProvider } from '/shared/types/ai';

import { useDispatch, useSelector } from '#store';
import { actions as aiActions } from '/@/modules/store/ai';

import { ChatView } from './ChatView';

interface Props {
  // Hide the inline panel.
  onClose: () => void;
  // Pop the chat out into a separate window (#1504).
  onPopOut: () => void;
  // Deselect all entities (clears the selection chips).
  onClearSelection: () => void;
  // Draggable panel width in px (owned by EditorPage).
  width: number;
}

// The inline chat panel: a thin container that wires the redux store + thunks to the shared
// presentational ChatView. The turn event stream, persistence and provider detection live
// in useAiSession (mounted in the editor), so this is purely a view over the store.
export function AiChatPanel({ onClose, onPopOut, onClearSelection, width }: Props) {
  const dispatch = useDispatch();
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
  } = useSelector(state => state.ai);

  const onSend = useCallback((text: string) => dispatch(aiActions.send(text)), [dispatch]);
  const onStop = useCallback(() => dispatch(aiActions.stop()), [dispatch]);
  const onNewChat = useCallback(() => dispatch(aiActions.newChat()), [dispatch]);
  const onProviderChange = useCallback(
    (p: AiProvider) => dispatch(aiActions.setProvider(p)),
    [dispatch],
  );
  const onRevertTurn = useCallback(
    (id: string, count: number) => dispatch(aiActions.revertTurn({ id, count })),
    [dispatch],
  );
  const onAnswerPrompt = useCallback(
    (id: string, answer: string) => dispatch(aiActions.answerPrompt({ id, answer })),
    [dispatch],
  );
  const onRecheck = useCallback(() => dispatch(aiActions.fetchProviders()), [dispatch]);
  const onDismissBilling = useCallback(() => dispatch(aiActions.dismissBilling()), [dispatch]);
  const onSwitchSession = useCallback(
    (id: string) => dispatch(aiActions.switchSession(id)),
    [dispatch],
  );
  const onDeleteSession = useCallback(
    (id: string) => dispatch(aiActions.deleteSession(id)),
    [dispatch],
  );

  return (
    <ChatView
      providers={providers}
      provider={provider}
      messages={messages}
      busy={busy}
      detecting={detecting}
      selection={selection}
      billingDismissed={billingDismissed}
      sessions={sessions}
      currentSessionId={currentSessionId}
      width={width}
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
      onPopOut={onPopOut}
      onClose={onClose}
    />
  );
}
