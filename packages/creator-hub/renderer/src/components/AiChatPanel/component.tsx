import { useCallback } from 'react';
import { shallowEqual } from 'react-redux';

import type { AiAssetMention, AiAttachment, AiProvider } from '/shared/types/ai';

import { useDispatch, useSelector } from '#store';
import { actions as aiActions } from '/@/modules/store/ai';
import { actions as aiSharingActions, selectSharingView } from '/@/modules/store/aiSharing';
import { useAuth } from '/@/hooks/useAuth';

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
    assetMentions,
    billingDismissed,
    sessions,
    currentSessionId,
    draftPrompt,
  } = useSelector(state => state.ai);

  const onSend = useCallback(
    (text: string, attachments?: AiAttachment[]) => dispatch(aiActions.send({ text, attachments })),
    [dispatch],
  );
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
  const onRemoveAssetMention = useCallback(
    (mention: AiAssetMention) => dispatch(aiActions.removeAssetMention(mention)),
    [dispatch],
  );
  const onDraftConsumed = useCallback(() => dispatch(aiActions.consumeDraftPrompt()), [dispatch]);
  const { wallet } = useAuth();
  const sharing = useSelector(
    state => selectSharingView(state, wallet?.toLowerCase() ?? null),
    shallowEqual,
  );
  const onShareDecision = useCallback(
    (granted: boolean) => dispatch(aiSharingActions.decide(granted)),
    [dispatch],
  );
  const onShareNotNow = useCallback(() => dispatch(aiSharingActions.notNow()), [dispatch]);
  const onSetConversationShared = useCallback(
    (shared: boolean) => dispatch(aiActions.setConversationShared(shared)),
    [dispatch],
  );

  return (
    <ChatView
      draftPrompt={draftPrompt}
      onDraftConsumed={onDraftConsumed}
      providers={providers}
      provider={provider}
      messages={messages}
      busy={busy}
      detecting={detecting}
      selection={selection}
      assetMentions={assetMentions}
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
      onRemoveAssetMention={onRemoveAssetMention}
      onPopOut={onPopOut}
      onClose={onClose}
      sharing={sharing}
      onShareDecision={onShareDecision}
      onShareNotNow={onShareNotNow}
      onSetConversationShared={onSetConversationShared}
    />
  );
}
