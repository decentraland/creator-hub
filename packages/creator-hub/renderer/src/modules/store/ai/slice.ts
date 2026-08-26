import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { ai } from '#preload';
import type { AiEvent, AiProvider } from '/shared/types/ai';

import { createAsyncThunk } from '/@/modules/store/thunk';
import {
  clearStoredConversation,
  readBillingDismissed,
  readConversation,
  writeBillingDismissed,
  writeConversation,
} from './persistence';
import type { AiMessage, AiState } from './types';

const initialState: AiState = {
  providers: [],
  provider: 'claude',
  model: 'default',
  messages: [],
  busy: false,
  detecting: false,
  selection: [],
  billingDismissed: false,
};

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
    dispatch(actions.pushUserMessage(trimmed));
    dispatch(actions.setBusy(true)); // optimistic; the `started` event confirms
    // Attach the current editor selection as context so the assistant can resolve "this"
    // without the user spelling out ids. Not shown in the chat bubble (main prepends it).
    const context = selectionContext(selection);
    const apiKeyFromEnv = state.workspace.settings?.useApiKeyFromEnv ?? false;
    await ai.send(path, { provider, model, text: trimmed, context, apiKeyFromEnv });
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

// Start a fresh conversation: drop the resume ids in main, the saved transcript on disk, and
// the in-memory transcript — all scoped to the open project.
export const newChat = createAsyncThunk('ai/newChat', async (_: void, { getState, dispatch }) => {
  const path = getState().editor.project?.path;
  await ai.reset(path);
  if (path !== undefined && path !== '') clearStoredConversation(path);
  dispatch(actions.clearConversation());
});

// Load a project's saved transcript into the panel (called when the panel opens / the project
// changes). Skips while a turn is running so it can't clobber an in-flight conversation.
export const loadConversation = createAsyncThunk<void, string>(
  'ai/loadConversation',
  (path, { getState, dispatch }) => {
    if (getState().ai.busy) return;
    dispatch(actions.hydrate(readConversation(path)));
    dispatch(actions.setBillingDismissed(readBillingDismissed(path)));
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

// Save the open project's transcript (called when a turn completes) so it survives a restart.
export const persistConversation = createAsyncThunk(
  'ai/persistConversation',
  (_: void, { getState }) => {
    const { ai: aiState, editor } = getState();
    const path = editor.project?.path;
    if (path !== undefined && path !== '') writeConversation(path, aiState.messages);
  },
);

// Revert the scene-graph changes an assistant turn made (undo its `mutations` steps).
export const revertTurn = createAsyncThunk<void, { id: string; count: number }>(
  'ai/revertTurn',
  async ({ id, count }, { dispatch }) => {
    await ai.revertTurn(count);
    dispatch(actions.markReverted(id));
  },
);

const slice = createSlice({
  name: 'ai',
  initialState,
  reducers: {
    setProvider: (state, { payload }: PayloadAction<AiProvider>) => {
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
    clearConversation: state => {
      state.messages = [];
      state.busy = false;
    },
    // Replace the transcript with a project's saved one (on open). Selection isn't restored —
    // it's re-polled live from the editor.
    hydrate: (state, { payload }: PayloadAction<AiMessage[]>) => {
      state.messages = payload;
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
        // If the selected provider isn't available, fall to the first that is.
        const current = payload.find(p => p.id === state.provider);
        if (current === undefined || !current.available) {
          const firstAvailable = payload.find(p => p.available);
          if (firstAvailable !== undefined) {
            state.provider = firstAvailable.id;
            state.model = firstAvailable.defaultModel;
          }
        }
      })
      .addCase(fetchProviders.rejected, state => {
        state.detecting = false;
      })
      // A send that main rejected (e.g. CLI vanished mid-session): drop the optimistic
      // busy flag and surface the error on the last assistant bubble, or a new one.
      .addCase(send.rejected, (state, action) => {
        state.busy = false;
        const message = action.error.message ?? 'The assistant failed to start.';
        const last = state.messages[state.messages.length - 1];
        if (last !== undefined && last.role === 'assistant' && !last.done) {
          last.error = message;
          last.done = true;
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
};
export const reducer = slice.reducer;
