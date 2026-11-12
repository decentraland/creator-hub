import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { AiSharingView } from '/shared/types/ai';
import {
  AI_SHARING_CONSENT_VERSION,
  hasSharingConsent,
  type AiSharingConsent,
  type AiSharingQueuedItem,
  type AiTurnRecord,
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
    // Best effort: if this fails, the uploader's sync sends the same decision later.
    if (AuthServerProvider.getAccount()) {
      const response = await api.putConsent(toServerDecision(consent));
      dispatch(actions.setServerConsentSynced(response.ok));
    }
    await dispatch(refreshQueue());
  },
);

const toServerDecision = (consent: AiSharingConsent): api.AiSharingDecision => ({
  granted: consent.consent === 'granted',
  version: consent.version,
  decidedAt: consent.decidedAt,
});

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

let flushing = false;

/**
 * Uploads what main queued for the signed-in account, a batch at a time. Records for another
 * account stay queued until it signs in again (main drops them after 7 days).
 */
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

/**
 * Makes the server's consent agree with this machine's, once per run and account. The newer
 * decision wins: ours is sent with its original time (never re-dated, so the server's history
 * shows when the creator actually decided); a newer one from the server, such as a withdrawal
 * on another machine, replaces ours. Returns whether uploading may go ahead.
 */
async function syncConsent(getState: () => AppState, dispatch: AppDispatch): Promise<boolean> {
  const local = selectSharingConsent(getState());
  if (local === undefined) return false;
  const remote = await api.getConsent();
  if (!remote.ok) return false;
  const remoteAt = remote.data.decidedAt === null ? 0 : Date.parse(remote.data.decidedAt);
  const localAt = Date.parse(local.decidedAt);

  if (remoteAt > localAt) {
    const adopted: AiSharingConsent = {
      consent: remote.data.granted ? 'granted' : 'denied',
      version: remote.data.version ?? AI_SHARING_CONSENT_VERSION,
      decidedAt: remote.data.decidedAt ?? new Date().toISOString(),
    };
    const settings = getState().workspace.settings;
    await dispatch(workspaceActions.updateSettings({ ...settings, aiDataSharing: adopted }));
    if (!remote.data.granted) await aiSharing.purge();
  } else if (remoteAt < localAt) {
    const sent = await api.putConsent(toServerDecision(local));
    if (!sent.ok) return false;
  }
  dispatch(actions.setServerConsentSynced(true));
  return hasSharingConsent(selectSharingConsent(getState()));
}

/** Records per upload, kept under the service's body cap whatever the records weigh. */
function nextBatch(records: AiTurnRecord[], maxRecords: number): AiTurnRecord[] {
  const batch: AiTurnRecord[] = [];
  let bytes = UPLOAD_ENVELOPE_BYTES;
  for (const record of records.slice(0, maxRecords)) {
    const size = new TextEncoder().encode(JSON.stringify(record)).length + 1;
    if (batch.length > 0 && bytes + size > api.MAX_UPLOAD_BYTES) break;
    batch.push(record);
    bytes += size;
  }
  return batch;
}

const UPLOAD_ENVELOPE_BYTES = '{"records":[]}'.length;

async function flushQueue(getState: () => AppState, dispatch: AppDispatch): Promise<void> {
  const state = getState();
  const address = AuthServerProvider.getAccount();
  if (!isSharingFeatureOn(state) || !address) return;
  if (selectSharingConsent(state) === undefined) return;
  if (Date.now() < state.aiSharing.nextUploadAt) return;

  // Runs for a "no" too, so a withdrawal that failed to reach the server gets there.
  if (!state.aiSharing.serverConsentSynced && !(await syncConsent(getState, dispatch))) {
    if (!getState().aiSharing.serverConsentSynced) dispatch(actions.uploadFailed());
    await dispatch(refreshQueue());
    return;
  }
  if (!hasSharingConsent(selectSharingConsent(getState()))) return;

  // Lowered when the service still finds a batch too large (a proxy in front of it with a
  // smaller cap, say), so the next try sends fewer records.
  let maxRecords: number = api.MAX_RECORDS_PER_UPLOAD;
  for (;;) {
    const queued = await aiSharing.peek(address, api.MAX_RECORDS_PER_UPLOAD);
    if (queued.length === 0) break;
    const batch = nextBatch(queued, maxRecords);
    const ids = batch.map(r => r.recordId);
    const response = await api.uploadTurns(batch);

    if (response.ok) {
      // Rejected records failed validation and would fail again, so they leave the queue too.
      if (response.data.rejected.length > 0) {
        console.warn('[AI sharing] the service rejected records', response.data.rejected);
      }
      await aiSharing.ack(ids);
      dispatch(actions.uploadSucceeded());
      continue;
    }
    if (response.status === 403) {
      // The server holds no current consent for this account: decided otherwise elsewhere, or
      // the consent text changed. Stop, and let the next sync settle whose decision stands.
      dispatch(actions.setServerConsentSynced(false));
      dispatch(actions.uploadFailed());
      break;
    }
    if (response.status === 413) {
      if (batch.length > 1) {
        maxRecords = Math.ceil(batch.length / 2);
        continue;
      }
      console.warn('[AI sharing] dropped a record larger than the service accepts', ids);
      await aiSharing.ack(ids);
      continue;
    }
    if (response.status === 400) {
      // The request itself is malformed; sending it again can't help, and it would block the
      // queue. Ids only, never content.
      console.warn('[AI sharing] dropped records the service could not read', ids);
      await aiSharing.ack(ids);
      continue;
    }
    // Network errors, 401 (clock skew, expired identity), 429, 503 (writes off) and 5xx are
    // passing conditions: keep the records and try later.
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
