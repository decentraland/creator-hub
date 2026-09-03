import { useCallback, useEffect, useRef, useState } from 'react';

import { ai as aiPreload } from '#preload';
import { useDispatch, useSelector } from '#store';
import { actions as aiActions } from '/@/modules/store/ai';

// Coalesce mirror pushes to the detached window to at most one per this interval (P2-1).
const MIRROR_THROTTLE_MS = 60;

// The AI session engine, mounted once in the editor (main window) whenever the assistant
// is enabled — independent of whether the chat is shown inline or popped out (#1504). It
// owns provider detection, the turn event stream, transcript persistence and conversation
// loading, so they keep running while the inline panel is hidden. It also bridges the
// detached window: it mirrors the store's `ai` slice to it and applies the actions it
// sends back, so the main window stays the single source of truth (no forked store).
export function useAiSession(
  enabled: boolean,
  projectPath: string | undefined,
  // Deselect all entities in the editor. Only the caller (EditorPage) holds the inspector
  // iframe RPC, so it supplies this; the detached window triggers it via a remote command.
  onClearSelection?: () => void,
) {
  const dispatch = useDispatch();
  const aiState = useSelector(state => state.ai);
  const projectTitle = useSelector(state => state.editor.project?.title);
  const locale = useSelector(state => state.translation.locale);
  const [detachedOpen, setDetachedOpen] = useState(false);
  // Latest snapshot + clear callback, read by the (stable) remote-command listener so it
  // doesn't need to re-subscribe on every streamed token / callback identity change.
  const latest = useRef({ aiState, projectTitle, onClearSelection });
  latest.current = { aiState, projectTitle, onClearSelection };

  // Provider detection + the turn event stream (fold events into the store, persist on done).
  useEffect(() => {
    if (!enabled) return;
    // If the editor was left mid-turn and the CLI child has since exited, its `done` event
    // was dropped and the store is stuck busy:true (which also blocks loadConversation).
    // Reconcile with main's real state so the UI doesn't hang on a spinner.
    void aiPreload.isBusy().then(mainBusy => {
      if (!mainBusy) dispatch(aiActions.stopped());
    });
    dispatch(aiActions.fetchProviders());
    const stream = aiPreload.subscribeAiStream(event => {
      dispatch(aiActions.applyEvent(event));
      if (event.kind === 'done') dispatch(aiActions.persistConversation());
    });
    // Interactive `ask_user` prompts arrive on their own channel (they block an MCP tool call,
    // not a stream token) — fold each into the transcript.
    const ask = aiPreload.onAskRequest(req => dispatch(aiActions.pushPrompt(req)));
    return () => {
      stream.cleanup();
      ask.cleanup();
    };
  }, [enabled, dispatch]);

  // Killing the CLI child when the assistant is turned OFF mid-turn (not on navigate-away —
  // that leaves the turn to finish and reconciles on return, above). A running child edits
  // files with bypassPermissions, so a disable must stop it, not just hide the UI.
  const prevEnabled = useRef(enabled);
  useEffect(() => {
    if (prevEnabled.current && !enabled) {
      void aiPreload.stop();
      dispatch(aiActions.stopped());
    }
    prevEnabled.current = enabled;
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
        case 'answerPrompt':
          dispatch(aiActions.answerPrompt({ id: command.id, answer: command.answer }));
          break;
        case 'fetchProviders':
          dispatch(aiActions.fetchProviders());
          break;
        case 'dismissBilling':
          dispatch(aiActions.dismissBilling());
          break;
        case 'switchSession':
          dispatch(aiActions.switchSession(command.id));
          break;
        case 'deleteSession':
          dispatch(aiActions.deleteSession(command.id));
          break;
        case 'clearSelection':
          latest.current.onClearSelection?.();
          break;
        case 'sync':
          aiPreload.pushAiMirrorState({
            ...latest.current.aiState,
            projectTitle: latest.current.projectTitle,
          });
          break;
        default: {
          // Compile error if a new AiRemoteCommand variant is added without a case here.
          const _exhaustive: never = command;
          return _exhaustive;
        }
      }
    });
    return cleanup;
  }, [enabled, dispatch]);

  // Mirror the store's `ai` slice to the detached window while it's open — throttled, since
  // this fires on every streamed token and the payload is the whole transcript (P2-1). A
  // leading + trailing throttle keeps the detached window responsive without a push per token.
  const mirrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMirror = useRef(0);
  useEffect(() => {
    if (!enabled || !detachedOpen) return;
    const push = () => {
      lastMirror.current = Date.now();
      aiPreload.pushAiMirrorState({
        ...latest.current.aiState,
        projectTitle: latest.current.projectTitle,
      });
    };
    const elapsed = Date.now() - lastMirror.current;
    if (elapsed >= MIRROR_THROTTLE_MS) {
      push();
    } else if (mirrorTimer.current === null) {
      mirrorTimer.current = setTimeout(() => {
        mirrorTimer.current = null;
        push();
      }, MIRROR_THROTTLE_MS - elapsed);
    }
  }, [enabled, detachedOpen, aiState, projectTitle]);

  // Cancel a pending mirror push on unmount.
  useEffect(
    () => () => {
      if (mirrorTimer.current !== null) clearTimeout(mirrorTimer.current);
    },
    [],
  );

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
