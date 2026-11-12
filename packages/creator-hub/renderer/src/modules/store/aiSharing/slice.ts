import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { AiSharingView } from '/shared/types/ai';
import {
  AI_SHARING_CONSENT_VERSION,
  hasSharingConsent,
  type AiSharingConsent,
  type AiSharingQueuedItem,
} from '/shared/types/ai-sharing';

import { aiSharing } from '#preload';
import { AuthServerProvider } from '/@/lib/auth';
import * as api from '/@/lib/aiSharingApi';
import { createAsyncThunk } from '/@/modules/store/thunk';
import { actions as workspaceActions } from '/@/modules/store/workspace';
import { FeatureFlag } from '/@/modules/store/featureFlags/types';
import type { AppDispatch, AppState } from '/@/modules/store';

/** Backoff between failed uploads: 1, 2, 4… minutes, capped at an hour. */
const MIN_BACKOFF_MS = 60_000;
const MAX_BACKOFF_MS = 60 * 60_000;

export type DeleteStatus = 'idle' | 'deleting' | 'deleted' | 'failed';

export interface AiSharingState {
  /** The consent card's "Not now", for this app run only. */
  notNow: boolean;
  queued: AiSharingQueuedItem[];
  deleteStatus: DeleteStatus;
  deletedCount: number | null;
  /** The server agreed with our consent this run, so uploads may start. */
  serverConsentSynced: boolean;
  failures: number;
  nextUploadAt: number;
}

const initialState: AiSharingState = {
  notNow: false,
  queued: [],
  deleteStatus: 'idle',
  deletedCount: null,
  serverConsentSynced: false,
  failures: 0,
  nextUploadAt: 0,
};

export const isSharingFeatureOn = (state: AppState): boolean =>
  state.featureFlags.flags[FeatureFlag.AI_PROMPT_SHARING] === true && api.isConfigured();

export const selectSharingConsent = (state: AppState): AiSharingConsent | undefined =>
  state.workspace.settings?.aiDataSharing;

/** Whether a turn sent now should be shared: feature on, consent current, signed in, not excluded. */
export function shouldShareTurn(state: AppState): boolean {
  if (!isSharingFeatureOn(state)) return false;
  if (!hasSharingConsent(selectSharingConsent(state))) return false;
  if (!AuthServerProvider.getAccount()) return false;
  const session = state.ai.sessions.find(s => s.id === state.ai.currentSessionId);
  return session?.shareExcluded !== true;
}

/**
 * What the chat shows. The card waits for a first finished reply (asking before anything has
 * happened gets reflexive "no"s), and comes back after a consent version bump only for those
 * who had said yes.
 */
export function selectSharingView(state: AppState, isSignedIn: boolean): AiSharingView {
  const session = state.ai.sessions.find(s => s.id === state.ai.currentSessionId);
  const conversationExcluded = session?.shareExcluded === true;
  if (!isSharingFeatureOn(state)) return { status: 'hidden', conversationExcluded };
  const consent = selectSharingConsent(state);
  if (hasSharingConsent(consent)) return { status: 'on', conversationExcluded };
  const neverAsked =
    consent === undefined ||
    (consent.consent === 'granted' && consent.version < AI_SHARING_CONSENT_VERSION);
  const hasReply = state.ai.messages.some(m => m.role === 'assistant' && m.done && !m.error);
  if (!neverAsked || state.aiSharing.notNow || !hasReply) {
    return { status: 'hidden', conversationExcluded };
  }
  return { status: isSignedIn ? 'ask' : 'signin', conversationExcluded };
}

export const refreshQueue = createAsyncThunk('aiSharing/refreshQueue', () => aiSharing.list());

/** The user's answer on the card or the Settings switch. A "no" also empties the local queue. */
export const decide = createAsyncThunk(
  'aiSharing/decide',
  async (granted: boolean, { getState, dispatch }) => {
    const settings = getState().workspace.settings;
    const consent: AiSharingConsent = {
      consent: granted ? 'granted' : 'denied',
      version: AI_SHARING_CONSENT_VERSION,
      decidedAt: new Date().toISOString(),
    };
    await dispatch(workspaceActions.updateSettings({ ...settings, aiDataSharing: consent }));
    if (!granted) await aiSharing.purge();
    // Best effort: the uploader re-sends consent before its first upload anyway.
    if (AuthServerProvider.getAccount()) {
      const response = await api.putConsent(granted, AI_SHARING_CONSENT_VERSION);
      if (response.ok) dispatch(actions.setServerConsentSynced(granted));
    }
    await dispatch(refreshQueue());
  },
);

/** "Delete everything I've shared": the server copy, then the local queue, then consent. */
export const deleteEverything = createAsyncThunk(
  'aiSharing/deleteEverything',
  async (_: void, { dispatch, rejectWithValue }) => {
    const response = await api.deleteAllTurns();
    if (!response.ok) return rejectWithValue(response.error);
    await aiSharing.purge();
    await dispatch(decide(false));
    return response.data.deleted;
  },
);

/**
 * Uploads what main queued for the signed-in account, a batch at a time. Records for another
 * account stay queued until it signs in again (main drops them after 7 days).
 */
let flushing = false;

export const flush = createAsyncThunk(
  'aiSharing/flush',
  async (_: void, { getState, dispatch }) => {
    // The timer and a consent change can both start one; two at once would upload a batch twice.
    if (flushing) return;
    flushing = true;
    try {
      await flushQueue(getState, dispatch);
    } finally {
      flushing = false;
    }
  },
);

async function flushQueue(getState: () => AppState, dispatch: AppDispatch): Promise<void> {
  const state = getState();
  const address = AuthServerProvider.getAccount();
  if (!isSharingFeatureOn(state) || !address) return;
  if (!hasSharingConsent(selectSharingConsent(state))) return;
  if (Date.now() < state.aiSharing.nextUploadAt) return;

  if (!state.aiSharing.serverConsentSynced) {
    const response = await api.putConsent(true, AI_SHARING_CONSENT_VERSION);
    if (!response.ok) {
      dispatch(actions.uploadFailed());
      return;
    }
    dispatch(actions.setServerConsentSynced(true));
  }

  for (;;) {
    const batch = await aiSharing.peek(address, api.MAX_RECORDS_PER_UPLOAD);
    if (batch.length === 0) break;
    const response = await api.uploadTurns(batch);
    if (response.ok) {
      await aiSharing.ack(batch.map(r => r.recordId));
      dispatch(actions.uploadSucceeded());
      continue;
    }
    if (response.status === 403) {
      // The server has no consent for this account (withdrawn on another machine, or deleted).
      // Its record wins: stop, empty the queue, and ask again.
      await aiSharing.purge();
      const settings = getState().workspace.settings;
      const { aiDataSharing: _dropped, ...rest } = settings;
      await dispatch(workspaceActions.updateSettings(rest));
      dispatch(actions.setServerConsentSynced(false));
      break;
    }
    if (response.status >= 400 && response.status < 500 && response.status !== 429) {
      // The service will never take these records; keeping them would block the queue forever.
      console.warn(
        `[AI sharing] dropped ${batch.length} records the service rejected (${response.status})`,
        batch.map(r => r.recordId),
      );
      await aiSharing.ack(batch.map(r => r.recordId));
      continue;
    }
    dispatch(actions.uploadFailed());
    break;
  }
  await dispatch(refreshQueue());
}

const slice = createSlice({
  name: 'aiSharing',
  initialState,
  reducers: {
    notNow: state => {
      state.notNow = true;
    },
    setServerConsentSynced: (state, { payload }: PayloadAction<boolean>) => {
      state.serverConsentSynced = payload;
    },
    uploadSucceeded: state => {
      state.failures = 0;
      state.nextUploadAt = 0;
    },
    uploadFailed: state => {
      state.failures += 1;
      const wait = Math.min(MIN_BACKOFF_MS * 2 ** (state.failures - 1), MAX_BACKOFF_MS);
      state.nextUploadAt = Date.now() + wait;
    },
    resetDelete: state => {
      state.deleteStatus = 'idle';
      state.deletedCount = null;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(refreshQueue.fulfilled, (state, { payload }) => {
        state.queued = payload;
      })
      .addCase(deleteEverything.pending, state => {
        state.deleteStatus = 'deleting';
        state.deletedCount = null;
      })
      .addCase(deleteEverything.fulfilled, (state, { payload }) => {
        state.deleteStatus = 'deleted';
        state.deletedCount = payload;
      })
      .addCase(deleteEverything.rejected, state => {
        state.deleteStatus = 'failed';
      });
  },
});

export const actions = {
  ...slice.actions,
  refreshQueue,
  decide,
  deleteEverything,
  flush,
};
export const reducer = slice.reducer;
