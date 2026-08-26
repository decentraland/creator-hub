import { useCallback, useEffect, useRef, useState } from 'react';

import { ai as aiPreload } from '#preload';
import { useDispatch, useSelector } from '#store';
import { actions as aiActions } from '/@/modules/store/ai';

// The AI session engine, mounted once in the editor (main window) whenever the assistant
// is enabled — independent of whether the chat is shown inline or popped out (#1504). It
// owns provider detection, the turn event stream, transcript persistence and conversation
// loading, so they keep running while the inline panel is hidden. It also bridges the
// detached window: it mirrors the store's `ai` slice to it and applies the actions it
// sends back, so the main window stays the single source of truth (no forked store).
export function useAiSession(enabled: boolean, projectPath: string | undefined) {
  const dispatch = useDispatch();
  const aiState = useSelector(state => state.ai);
  const projectTitle = useSelector(state => state.editor.project?.title);
  const locale = useSelector(state => state.translation.locale);
  const [detachedOpen, setDetachedOpen] = useState(false);
  // Latest snapshot, read by the (stable) remote-command listener so it doesn't need to
  // re-subscribe on every streamed token.
  const latest = useRef({ aiState, projectTitle });
  latest.current = { aiState, projectTitle };

  // Provider detection + the turn event stream (fold events into the store, persist on done).
  useEffect(() => {
    if (!enabled) return;
    dispatch(aiActions.fetchProviders());
    const { cleanup } = aiPreload.subscribeAiStream(event => {
      dispatch(aiActions.applyEvent(event));
      if (event.kind === 'done') dispatch(aiActions.persistConversation());
    });
    return cleanup;
  }, [enabled, dispatch]);

  // Restore the open project's saved conversation when the project changes.
  useEffect(() => {
    if (!enabled) return;
    if (projectPath !== undefined && projectPath !== '') {
      dispatch(aiActions.loadConversation(projectPath));
    }
  }, [enabled, projectPath, dispatch]);

  // Learn whether the detached window is open (initial + on change), so the caller can show
  // the inline panel or a "opened in a separate window" placeholder.
  useEffect(() => {
    if (!enabled) return;
    void aiPreload.isAiWindowOpen().then(setDetachedOpen);
    const { cleanup } = aiPreload.onAiWindowState(({ open }) => setDetachedOpen(open));
    return cleanup;
  }, [enabled]);

  // Apply the detached window's actions against this (single) store. `sync` is its request
  // for the current state on mount — the mirror effect below answers it.
  useEffect(() => {
    if (!enabled) return;
    const { cleanup } = aiPreload.onAiRemoteCommand(command => {
      switch (command.type) {
        case 'send':
          dispatch(aiActions.send(command.text));
          break;
        case 'stop':
          dispatch(aiActions.stop());
          break;
        case 'newChat':
          dispatch(aiActions.newChat());
          break;
        case 'setProvider':
          dispatch(aiActions.setProvider(command.provider));
          break;
        case 'revertTurn':
          dispatch(aiActions.revertTurn({ id: command.id, count: command.count }));
          break;
        case 'fetchProviders':
          dispatch(aiActions.fetchProviders());
          break;
        case 'dismissBilling':
          dispatch(aiActions.dismissBilling());
          break;
        case 'sync':
          aiPreload.pushAiMirrorState({
            ...latest.current.aiState,
            projectTitle: latest.current.projectTitle,
          });
          break;
      }
    });
    return cleanup;
  }, [enabled, dispatch]);

  // Mirror the store's `ai` slice to the detached window while it's open.
  useEffect(() => {
    if (!enabled || !detachedOpen) return;
    aiPreload.pushAiMirrorState({ ...aiState, projectTitle });
  }, [enabled, detachedOpen, aiState, projectTitle]);

  // The detached window relies on this hook (the main window's engine) for its state and
  // to run its commands. Close it when the editor unmounts (navigating away) or the
  // assistant is turned off, so it can't linger disconnected.
  useEffect(() => {
    if (!enabled) return;
    return () => {
      void aiPreload.closeAiWindow();
    };
  }, [enabled]);

  const openDetached = useCallback(() => {
    void aiPreload.openAiWindow(locale);
  }, [locale]);

  const closeDetached = useCallback(() => {
    void aiPreload.closeAiWindow();
  }, []);

  return { detachedOpen, openDetached, closeDetached };
}
