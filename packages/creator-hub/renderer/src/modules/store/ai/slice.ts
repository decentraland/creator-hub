import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { ai } from '#preload';
import type { AiEvent, AiProvider } from '/shared/types/ai';

import { createAsyncThunk } from '/@/modules/store/thunk';
import {
  deleteSessionStorage,
  readBillingDismissed,
  readSessionIndex,
  readSessionMessages,
  writeBillingDismissed,
  writeSessionIndex,
  writeSessionMessages,
} from './persistence';
import type { AiMessage, AiSessionMeta, AiState } from './types';

const initialState: AiState = {
  providers: [],
  provider: 'claude',
  providerPinned: false,
  model: 'default',
  messages: [],
  busy: false,
  detecting: false,
  selection: [],
  billingDismissed: false,
  sessions: [],
  currentSessionId: '',
};

// A session's title is its first user prompt (trimmed/clipped); empty until it has one, so
// a brand-new session renders as "New chat". Exported for tests.
export function sessionTitle(messages: AiMessage[]): string {
  const firstUser = messages.find(m => m.role === 'user');
  if (firstUser === undefined) return '';
  const t = firstUser.text.trim().replace(/\s+/g, ' ');
  return t.length > 48 ? `${t.slice(0, 48)}…` : t;
}

// The saved (non-empty) sessions from an in-memory list: everything but the current
// not-yet-used session (the only one with an empty title). Newest first is preserved.
function savedSessions(sessions: AiSessionMeta[]): AiSessionMeta[] {
  return sessions.filter(s => s.title !== '');
}

// Ask main which CLIs are installed/runnable. Cheap scan first, login-shell probe only
// if something's missing — that cost lives in main.
export const fetchProviders = createAsyncThunk('ai/fetchProviders', () => ai.detectProviders());

// Run one turn. Reads the selected provider/model and the open project's path from
// state; the assistant bubble is created when the `started` event arrives on the stream
// (the panel subscribes to it). The turn streams asynchronously — this resolves as soon
// as main has spawned the child.
export const send = createAsyncThunk<void, string>(
  'ai/send',
  async (text, { getState, dispatch }) => {
    const state = getState();
    const path = state.editor.project?.path;
    if (path === undefined || path === '')
      throw new Error('Open a scene before using the assistant.');
    const { provider, model, busy, selection } = state.ai;
    if (busy) return; // one turn at a time
    const trimmed = text.trim();
    if (trimmed === '') return;
    // Every turn belongs to a session (its transcript + the CLI resume id are keyed by it).
    // One should already exist from loadConversation; create one defensively if not.
    let sessionId = state.ai.currentSessionId;
    if (sessionId === '') {
      sessionId = crypto.randomUUID();
      dispatch(
        actions.setSessionState({
          sessions: [{ id: sessionId, title: '', updatedAt: Date.now() }],
          currentSessionId: sessionId,
          messages: [],
        }),
      );
    }
    dispatch(actions.pushUserMessage(trimmed));
    dispatch(actions.setBusy(true)); // optimistic; the `started` event confirms
    // Attach the current editor selection as context so the assistant can resolve "this"
    // without the user spelling out ids. Not shown in the chat bubble (main prepends it).
    const context = selectionContext(selection);
    const apiKeyFromEnv = state.workspace.settings?.useApiKeyFromEnv ?? false;
    await ai.send(path, { provider, model, text: trimmed, context, apiKeyFromEnv, sessionId });
  },
);

// One line naming what the user has selected, or undefined when nothing is. Kept terse —
// the assistant can call get_selection / scene_state for the full picture. Exported for tests.
export function selectionContext(selection: AiState['selection']): string | undefined {
  if (selection.length === 0) return undefined;
  const names = selection.map(s => `${s.name || 'Entity'} (id ${s.id})`).join(', ');
  return `[Editor context] The user currently has selected: ${names}. If they say "this" or "the selected entity", they mean ${selection.length === 1 ? 'that entity' : 'those entities'}.`;
}

// Kill the in-flight turn. Main suppresses the `done` event on an intentional stop, so
// the reducer finalizes the current bubble itself.
export const stop = createAsyncThunk('ai/stop', async (_: void, { dispatch }) => {
  await ai.stop();
  dispatch(actions.stopped());
});

// Start a fresh conversation, keeping the scene's past sessions in the history. Just a new
// in-memory session with an empty transcript — a fresh sessionId has no resume id in main,
// so the next turn starts a new CLI conversation on its own (no reset needed). The previous
// session stays saved; a not-yet-used one is dropped (only one empty session at a time).
export const newChat = createAsyncThunk('ai/newChat', (_: void, { getState, dispatch }) => {
  const id = crypto.randomUUID();
  const kept = savedSessions(getState().ai.sessions);
  dispatch(
    actions.setSessionState({
      sessions: [{ id, title: '', updatedAt: Date.now() }, ...kept],
      currentSessionId: id,
      messages: [],
    }),
  );
});

// Load a scene's saved sessions into the panel (called when the panel opens / the project
// changes). Restores the last-active session's transcript, or starts a fresh session if the
// scene has none. Skips while a turn is running so it can't clobber an in-flight conversation.
export const loadConversation = createAsyncThunk<void, string>(
  'ai/loadConversation',
  (path, { getState, dispatch }) => {
    if (getState().ai.busy) return;
    const { current, sessions } = readSessionIndex(path);
    if (sessions.length === 0) {
      const id = crypto.randomUUID();
      dispatch(
        actions.setSessionState({
          sessions: [{ id, title: '', updatedAt: Date.now() }],
          currentSessionId: id,
          messages: [],
        }),
      );
    } else {
      const activeId = sessions.some(s => s.id === current) ? current : sessions[0].id;
      dispatch(
        actions.setSessionState({
          sessions,
          currentSessionId: activeId,
          messages: readSessionMessages(path, activeId),
        }),
      );
    }
    dispatch(actions.setBillingDismissed(readBillingDismissed(path)));
  },
);

// Open a past session from the history: load its transcript and make the next turn resume
// its CLI thread. Drops the not-yet-used session (if any) — only one empty session at a time.
export const switchSession = createAsyncThunk<void, string>(
  'ai/switchSession',
  (id, { getState, dispatch }) => {
    const { ai: aiState, editor } = getState();
    if (aiState.busy || id === aiState.currentSessionId) return;
    const path = editor.project?.path;
    dispatch(
      actions.setSessionState({
        sessions: savedSessions(aiState.sessions),
        currentSessionId: id,
        messages: path !== undefined && path !== '' ? readSessionMessages(path, id) : [],
      }),
    );
  },
);

// Delete a session from the scene's history: its transcript, its meta, and its resume ids in
// main. If it was the active one, fall back to the newest remaining session (or a fresh one).
export const deleteSession = createAsyncThunk<void, string>(
  'ai/deleteSession',
  async (id, { getState, dispatch }) => {
    const { ai: aiState, editor } = getState();
    const path = editor.project?.path;
    if (path !== undefined && path !== '') {
      deleteSessionStorage(path, id);
      await ai.deleteSession(path, id);
    }
    let sessions = savedSessions(aiState.sessions).filter(s => s.id !== id);
    let currentSessionId = aiState.currentSessionId;
    let messages = aiState.messages;
    if (currentSessionId === id) {
      if (sessions.length > 0) {
        currentSessionId = sessions[0].id;
        messages =
          path !== undefined && path !== '' ? readSessionMessages(path, currentSessionId) : [];
      } else {
        currentSessionId = crypto.randomUUID();
        sessions = [{ id: currentSessionId, title: '', updatedAt: Date.now() }];
        messages = [];
      }
    }
    dispatch(actions.setSessionState({ sessions, currentSessionId, messages }));
    if (path !== undefined && path !== '') {
      writeSessionIndex(path, { current: currentSessionId, sessions: savedSessions(sessions) });
    }
  },
);

// Dismiss the "runs on your own account" billing hint for the open scene (#1505), and
// remember it per-project so it stays gone across restarts.
export const dismissBilling = createAsyncThunk(
  'ai/dismissBilling',
  (_: void, { getState, dispatch }) => {
    const path = getState().editor.project?.path;
    if (path !== undefined && path !== '') writeBillingDismissed(path, true);
    dispatch(actions.setBillingDismissed(true));
  },
);

// Save the active session's transcript (called when a turn completes) so it survives a
// restart, and update the scene's index: title from the first prompt, moved to the front,
// capped history. Reflects the new title/order back into the store for the history picker.
export const persistConversation = createAsyncThunk(
  'ai/persistConversation',
  (_: void, { getState, dispatch }) => {
    const { ai: aiState, editor } = getState();
    const path = editor.project?.path;
    const current = aiState.currentSessionId;
    if (path === undefined || path === '' || current === '') return;
    writeSessionMessages(path, current, aiState.messages);
    const meta: AiSessionMeta = {
      id: current,
      title: sessionTitle(aiState.messages),
      updatedAt: Date.now(),
    };
    const sessions = [meta, ...savedSessions(aiState.sessions).filter(s => s.id !== current)];
    writeSessionIndex(path, { current, sessions });
    dispatch(actions.setSessions({ sessions, currentSessionId: current }));
  },
);

// Revert the scene-graph changes an assistant turn made (undo its `mutations` steps).
// Mark reverted BEFORE awaiting: the detached window's mirror lags a hop, so a fast
// double-click can fire two reverts — the second would undo the user's own edits off the
// shared stack. Marking synchronously makes the second dispatch a no-op.
export const revertTurn = createAsyncThunk<void, { id: string; count: number }>(
  'ai/revertTurn',
  async ({ id, count }, { getState, dispatch }) => {
    const msg = getState().ai.messages.find(m => m.id === id);
    if (msg === undefined || msg.reverted) return;
    dispatch(actions.markReverted(id));
    await ai.revertTurn(count);
  },
);

const slice = createSlice({
  name: 'ai',
  initialState,
  reducers: {
    setProvider: (state, { payload }: PayloadAction<AiProvider>) => {
      // Pin even on a no-op re-pick: choosing the current provider is still an explicit
      // choice that should survive the next detection pass.
      state.providerPinned = true;
      if (payload === state.provider) return;
      state.provider = payload;
      const info = state.providers.find(p => p.id === payload);
      state.model = info?.defaultModel ?? 'default';
    },
    setModel: (state, { payload }: PayloadAction<string>) => {
      state.model = payload;
    },
    setBusy: (state, { payload }: PayloadAction<boolean>) => {
      state.busy = payload;
    },
    setSelection: (state, { payload }: PayloadAction<{ id: number; name: string }[]>) => {
      state.selection = payload;
    },
    setBillingDismissed: (state, { payload }: PayloadAction<boolean>) => {
      state.billingDismissed = payload;
    },
    pushUserMessage: (state, { payload }: PayloadAction<string>) => {
      const msg: AiMessage = {
        // A UUID (not a module-level counter) so ids can't collide with the persisted
        // transcript after an HMR reload resets module state but the store survives.
        id: `u-${crypto.randomUUID()}`,
        role: 'user',
        text: payload,
        tools: [],
        done: true,
      };
      state.messages.push(msg);
    },
    // Fold one streamed turn event into the transcript.
    applyEvent: (state, { payload }: PayloadAction<AiEvent>) => {
      const find = () => state.messages.find(m => m.id === payload.turnId);
      switch (payload.kind) {
        case 'started': {
          if (find() === undefined) {
            state.messages.push({
              id: payload.turnId,
              role: 'assistant',
              text: '',
              tools: [],
              done: false,
            });
          }
          state.busy = true;
          break;
        }
        case 'text': {
          const msg = find();
          if (msg !== undefined) msg.text += payload.text;
          break;
        }
        case 'tool': {
          const msg = find();
          if (msg !== undefined) msg.tools.push({ tool: payload.tool, detail: payload.detail });
          break;
        }
        case 'image': {
          const msg = find();
          if (msg !== undefined) (msg.images ??= []).push(payload.dataUrl);
          break;
        }
        case 'error': {
          const msg = find();
          if (msg !== undefined) msg.error = payload.message;
          break;
        }
        case 'done': {
          const msg = find();
          if (msg !== undefined) {
            msg.done = true;
            msg.mutations = payload.mutations;
          }
          state.busy = false;
          break;
        }
        default: {
          // Compile error if a new AiEvent kind is added without a case here.
          const _exhaustive: never = payload;
          return _exhaustive;
        }
      }
    },
    // Finalize on an intentional stop (no `done` event follows a kill).
    stopped: state => {
      state.busy = false;
      for (let i = state.messages.length - 1; i >= 0; i--) {
        const msg = state.messages[i];
        if (msg.role === 'assistant' && !msg.done) {
          msg.done = true;
          break;
        }
      }
    },
    // Replace the whole session view: the scene's session list, the active id and its
    // transcript (on load / new chat / switch / delete). Selection isn't restored — it's
    // re-polled live from the editor.
    setSessionState: (
      state,
      {
        payload,
      }: PayloadAction<{
        sessions: AiSessionMeta[];
        currentSessionId: string;
        messages: AiMessage[];
      }>,
    ) => {
      state.sessions = payload.sessions;
      state.currentSessionId = payload.currentSessionId;
      state.messages = payload.messages;
      state.busy = false;
    },
    // Update just the session list + active id (after a turn persists new title/order),
    // leaving the live transcript untouched.
    setSessions: (
      state,
      { payload }: PayloadAction<{ sessions: AiSessionMeta[]; currentSessionId: string }>,
    ) => {
      state.sessions = payload.sessions;
      state.currentSessionId = payload.currentSessionId;
    },
    markReverted: (state, { payload }: PayloadAction<string>) => {
      const msg = state.messages.find(m => m.id === payload);
      if (msg !== undefined) msg.reverted = true;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchProviders.pending, state => {
        state.detecting = true;
      })
      .addCase(fetchProviders.fulfilled, (state, { payload }) => {
        state.detecting = false;
        state.providers = payload;
        // On the first (un-pinned) detection, land on an available provider so the panel
        // opens ready to use. Once the user has explicitly picked one, respect it — even if
        // it's not signed in yet — so they can sit on its sign-in screen without being bounced.
        if (!state.providerPinned) {
          const current = payload.find(p => p.id === state.provider);
          if (current === undefined || !current.available) {
            const firstAvailable = payload.find(p => p.available);
            if (firstAvailable !== undefined) {
              state.provider = firstAvailable.id;
              state.model = firstAvailable.defaultModel;
            }
          }
        }
      })
      .addCase(fetchProviders.rejected, state => {
        state.detecting = false;
      })
      // A send that main rejected (e.g. CLI vanished mid-session, or no scene open): drop
      // the optimistic busy flag and surface the error. If there's an in-progress assistant
      // bubble, attach it there; otherwise (rejected before/without one — last is a user
      // bubble, or none) push a bubble to carry it, so the error is never silently dropped.
      .addCase(send.rejected, (state, action) => {
        state.busy = false;
        const message = action.error.message ?? 'The assistant failed to start.';
        const last = state.messages[state.messages.length - 1];
        if (last !== undefined && last.role === 'assistant' && !last.done) {
          last.error = message;
          last.done = true;
        } else {
          state.messages.push({
            id: `err-${crypto.randomUUID()}`,
            role: 'assistant',
            text: '',
            tools: [],
            done: true,
            error: message,
          });
        }
      });
  },
});

export const actions = {
  ...slice.actions,
  fetchProviders,
  send,
  stop,
  newChat,
  revertTurn,
  loadConversation,
  persistConversation,
  dismissBilling,
  switchSession,
  deleteSession,
};
export const reducer = slice.reducer;
