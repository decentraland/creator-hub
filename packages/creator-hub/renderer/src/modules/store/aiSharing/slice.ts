import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { AiSharingView } from '/shared/types/ai';
import {
  AI_SHARING_CONSENT_VERSION,
  consentFor,
  hasSharingConsent,
  type AiSharingConsent,
  type AiSharingQueuedItem,
  type AiTurnRecord,
} from '/shared/types/ai-sharing';
import type { MetricsResponse } from '/shared/types/metrics';

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

export type DeleteStatus = 'idle' | 'confirming' | 'deleting' | 'deleted' | 'failed';

export interface SharedTurnsState {
  status: 'idle' | 'loading' | 'loaded' | 'failed';
  // Bumped by every reset load and delete; a page from an older one is stale.
  generation: number;
  turns: api.AiSharingStoredTurn[];
  next: string | null;
  erasing: string[];
}

export interface AiSharingState {
  /** The consent card's "Not now", for this app run only. */
  notNow: boolean;
  queued: AiSharingQueuedItem[];
  deleteStatus: DeleteStatus;
  deletedCount: number | null;
  /** The wallet whose consent this run has settled with the service, so uploads may start. */
  syncedWallet: string | null;
  failures: number;
  nextUploadAt: number;
  /**
   * The service's consent version differs from the text this app shows (newer, or not yet
   * rolled out). No grant from this app can be accepted, so it stops offering sharing.
   */
  versionMismatch: boolean;
  /** What the signed-in wallet has shared, as the service holds it (Settings). */
  shared: SharedTurnsState;
}

const initialState: AiSharingState = {
  notNow: false,
  queued: [],
  deleteStatus: 'idle',
  deletedCount: null,
  syncedWallet: null,
  failures: 0,
  nextUploadAt: 0,
  versionMismatch: false,
  shared: { status: 'idle', generation: 0, turns: [], next: null, erasing: [] },
};

/** The signed-in wallet, lowercase, or null when signed out. */
export const currentWallet = (): string | null =>
  AuthServerProvider.getAccount()?.toLowerCase() ?? null;

/** Sharing can be offered and turns uploaded: the flag is on, the service exists and agrees. */
export const isSharingFeatureOn = (state: AppState): boolean =>
  state.featureFlags.flags[FeatureFlag.AI_PROMPT_SHARING] === true &&
  api.isConfigured() &&
  !state.aiSharing.versionMismatch;

/** The decision of `wallet` (the signed-in one by default). Consent belongs to the account. */
export const selectSharingConsent = (
  state: AppState,
  wallet: string | null = currentWallet(),
): AiSharingConsent | undefined => consentFor(state.workspace.settings?.aiDataSharing, wallet);

/**
 * Whether Settings shows the sharing controls: wherever sharing is offered, and wherever this
 * wallet has a decision stored, so withdrawing and erasing stay possible after the flag is
 * turned off or the consent text moves on.
 */
export const canManageSharing = (state: AppState, wallet: string | null): boolean =>
  isSharingFeatureOn(state) ||
  (api.isConfigured() && selectSharingConsent(state, wallet) !== undefined);

/** Whether a turn sent now should be shared: feature on, consent current, signed in, not excluded. */
export function shouldShareTurn(state: AppState): boolean {
  if (!isSharingFeatureOn(state)) return false;
  if (!hasSharingConsent(selectSharingConsent(state))) return false;
  const session = state.ai.sessions.find(s => s.id === state.ai.currentSessionId);
  return session?.shareExcluded !== true;
}

/**
 * What the chat shows. The card waits for a first finished reply (asking before anything has
 * happened gets reflexive "no"s), and comes back after a consent version bump only for those
 * who had said yes.
 */
export function selectSharingView(state: AppState, wallet: string | null): AiSharingView {
  const session = state.ai.sessions.find(s => s.id === state.ai.currentSessionId);
  const conversationExcluded = session?.shareExcluded === true;
  if (!isSharingFeatureOn(state)) return { status: 'hidden', conversationExcluded };
  const consent = selectSharingConsent(state, wallet);
  if (hasSharingConsent(consent)) return { status: 'on', conversationExcluded };
  const notAskedYet =
    consent === undefined ||
    (consent.consent === 'granted' && consent.version < AI_SHARING_CONSENT_VERSION);
  // A finished reply: not a failed turn, and not one the user stopped.
  const hasReply = state.ai.messages.some(
    m => m.role === 'assistant' && m.done && !m.error && !m.cancelled,
  );
  if (!notAskedYet || state.aiSharing.notNow || !hasReply) {
    return { status: 'hidden', conversationExcluded };
  }
  return { status: wallet !== null ? 'ask' : 'signin', conversationExcluded };
}

/** What main has queued for the signed-in wallet (other wallets' records stay hidden). */
export const refreshQueue = createAsyncThunk('aiSharing/refreshQueue', async () => {
  const wallet = currentWallet();
  return wallet === null ? [] : aiSharing.list(wallet);
});

async function saveConsent(
  getState: () => AppState,
  dispatch: AppDispatch,
  wallet: string,
  consent: AiSharingConsent,
): Promise<void> {
  const settings = getState().workspace.settings;
  await dispatch(
    workspaceActions.updateSettings({
      ...settings,
      aiDataSharing: { ...settings.aiDataSharing, [wallet]: consent },
    }),
  );
}

const toServerDecision = (consent: AiSharingConsent): api.AiSharingDecision => ({
  granted: consent.consent === 'granted',
  version: consent.version,
  decidedAt: consent.decidedAt,
});

/**
 * The service names a consent version other than this app's in a 403 or 409: newer than the text
 * this app can show, or one it hasn't rolled out yet. Either way no grant from here can be
 * accepted, so stop offering sharing. Returns whether that is the case.
 */
function checkVersionMismatch(dispatch: AppDispatch, response: { body?: unknown }): boolean {
  const version = (response.body as { currentVersion?: unknown } | undefined)?.currentVersion;
  if (typeof version !== 'number' || version === AI_SHARING_CONSENT_VERSION) return false;
  dispatch(actions.setVersionMismatch());
  return true;
}

/** Takes the service's latest decision as this wallet's, emptying its queue on a "no". */
async function adoptRemote(
  getState: () => AppState,
  dispatch: AppDispatch,
  wallet: string,
  remote: api.AiSharingConsentState,
): Promise<void> {
  if (remote.decidedAt === null || remote.version === null) return;
  await saveConsent(getState, dispatch, wallet, {
    consent: remote.granted ? 'granted' : 'denied',
    version: remote.version,
    decidedAt: remote.decidedAt,
    delivered: true,
  });
  if (!remote.granted) await aiSharing.purge(wallet);
}

/**
 * Sends this wallet's decision. The service orders decisions by when it receives them, so the
 * creator's latest click wins; it refuses (409) a grant older than a withdrawal it already holds,
 * which is an offline machine delivering a stale "yes" after the creator said no elsewhere. Then
 * the withdrawal stands here too. Returns whether the service now holds a decision for us.
 */
async function deliver(
  getState: () => AppState,
  dispatch: AppDispatch,
  wallet: string,
  consent: AiSharingConsent,
): Promise<boolean> {
  const response = await api.putConsent(wallet, toServerDecision(consent));
  if (response.ok) {
    await saveConsent(getState, dispatch, wallet, { ...consent, delivered: true });
    return true;
  }
  if (response.status === 409) {
    if (checkVersionMismatch(dispatch, response)) return false;
    // A "no" is never replaced by the service's "yes": withdrawals always apply there, so a 409
    // on one is a transient refusal, and it is retried rather than undone.
    if (consent.consent === 'denied') return false;
    const remote = await api.getConsent(wallet);
    if (!remote.ok) return false;
    await adoptRemote(getState, dispatch, wallet, remote.data);
    return true;
  }
  return false;
}

/** The answer on the card or the Settings switch, for the signed-in wallet. */
export const decide = createAsyncThunk(
  'aiSharing/decide',
  async (granted: boolean, { getState, dispatch }) => {
    const wallet = currentWallet();
    if (wallet === null) return;
    const consent: AiSharingConsent = {
      consent: granted ? 'granted' : 'denied',
      version: AI_SHARING_CONSENT_VERSION,
      decidedAt: new Date().toISOString(),
      delivered: false,
    };
    // Saved before anything else: main reads it when a running turn ends.
    await saveConsent(getState, dispatch, wallet, consent);
    if (!granted) await aiSharing.purge(wallet);
    // If this fails, the decision stays undelivered and the uploader's sync sends it.
    const delivered = await deliver(getState, dispatch, wallet, consent);
    dispatch(actions.setSyncedWallet(delivered ? wallet : null));
    await dispatch(refreshQueue());
  },
);

/**
 * "Delete everything I've shared": sharing stops first (main reads the saved "no" when a running
 * turn ends), then the local queue goes, then the service erases the records and records the
 * withdrawal in one request, dated by this machine's clock like every other decision.
 */
export const deleteEverything = createAsyncThunk(
  'aiSharing/deleteEverything',
  async (_: void, { getState, dispatch, rejectWithValue }) => {
    const wallet = currentWallet();
    if (wallet === null) return rejectWithValue('Signed out');
    const withdrawal: AiSharingConsent = {
      consent: 'denied',
      version: AI_SHARING_CONSENT_VERSION,
      decidedAt: new Date().toISOString(),
      delivered: false,
    };
    await saveConsent(getState, dispatch, wallet, withdrawal);
    await aiSharing.purge(wallet);
    await dispatch(refreshQueue());
    const response = await api.eraseAll(wallet, withdrawal.decidedAt);
    if (!response.ok) {
      // The "no" stays saved and undelivered, so the uploader keeps retrying it.
      dispatch(actions.setSyncedWallet(null));
      return rejectWithValue(response.error);
    }
    await saveConsent(getState, dispatch, wallet, { ...withdrawal, delivered: true });
    dispatch(actions.setSyncedWallet(wallet));
    dispatch(actions.clearSharedTurns());
    return response.data.deleted;
  },
);

/** The next page of what the signed-in wallet has shared, or the first with `reset`. */
export const loadSharedTurns = createAsyncThunk(
  'aiSharing/loadSharedTurns',
  async ({ reset }: { reset: boolean }, { getState, rejectWithValue }) => {
    const wallet = currentWallet();
    if (wallet === null) return rejectWithValue('Signed out');
    // Read before the request: a delete or a fresh load that lands meanwhile bumps it, and this
    // page is then dropped instead of bringing back turns that are gone.
    const generation = getState().aiSharing.shared.generation;
    const cursor = reset ? null : getState().aiSharing.shared.next;
    const response = await api.listTurns(wallet, cursor);
    if (!response.ok) return rejectWithValue(response.error);
    return { ...response.data, reset, generation };
  },
);

/** Erases one shared turn; sharing stays on. */
export const eraseSharedTurn = createAsyncThunk(
  'aiSharing/eraseSharedTurn',
  async (recordId: string, { rejectWithValue }) => {
    const wallet = currentWallet();
    if (wallet === null) return rejectWithValue('Signed out');
    const response = await api.eraseTurn(wallet, recordId);
    if (!response.ok) return rejectWithValue(response.error);
    return recordId;
  },
);

let flushing = false;

/**
 * Settles consent with the service and uploads what main queued for the signed-in wallet, a
 * batch at a time. Records for another wallet stay queued until it signs in again (main drops
 * them after 7 days).
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
 * Makes this machine and the service agree on the wallet's decision, once per run and wallet. A
 * decision made here that never reached the service is sent, keeping its original time; so is
 * one the service has lost (a restore). Otherwise the service's latest decision is the creator's
 * latest anywhere (another machine's withdrawal, say) and is adopted. Returns whether they agree.
 */
async function syncConsent(
  getState: () => AppState,
  dispatch: AppDispatch,
  wallet: string,
): Promise<boolean> {
  const local = selectSharingConsent(getState(), wallet);
  if (local === undefined) return false;
  const remote = await api.getConsent(wallet);
  if (!remote.ok) return false;

  const sameAsRemote =
    remote.data.decidedAt === local.decidedAt &&
    remote.data.granted === (local.consent === 'granted') &&
    remote.data.version === local.version;
  let agreed = true;
  if (sameAsRemote) {
    if (local.delivered !== true) {
      await saveConsent(getState, dispatch, wallet, { ...local, delivered: true });
    }
  } else if (local.delivered !== true || remote.data.decidedAt === null) {
    agreed = await deliver(getState, dispatch, wallet, local);
  } else {
    await adoptRemote(getState, dispatch, wallet, remote.data);
  }
  if (agreed) dispatch(actions.setSyncedWallet(wallet));
  return agreed;
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

// Rejections that say nothing about the record itself: keep it and try again later.
const RETRYABLE_REJECTIONS = new Set(['address_mismatch']);

/** Whether uploading for `wallet` may continue: still signed in as it, still sharing. */
function mayUpload(state: AppState, wallet: string): boolean {
  return (
    currentWallet() === wallet &&
    isSharingFeatureOn(state) &&
    hasSharingConsent(selectSharingConsent(state, wallet))
  );
}

function backOff(dispatch: AppDispatch, response?: MetricsResponse<unknown>): void {
  const retryAfterSeconds =
    response !== undefined && !response.ok ? response.retryAfterSeconds : undefined;
  dispatch(actions.uploadFailed({ retryAfterSeconds }));
}

async function flushQueue(getState: () => AppState, dispatch: AppDispatch): Promise<void> {
  const wallet = currentWallet();
  if (!api.isConfigured() || wallet === null) return;
  const consent = selectSharingConsent(getState(), wallet);
  if (consent === undefined) return;
  if (Date.now() < getState().aiSharing.nextUploadAt) return;
  // A "yes" goes out only while sharing is offered (the flag on, the consent text matching): a
  // grant made offline must not reach the service after the feature was turned off. A "no"
  // always goes out.
  if (consent.consent === 'granted' && !isSharingFeatureOn(getState())) return;

  if (getState().aiSharing.syncedWallet !== wallet) {
    if (!(await syncConsent(getState, dispatch, wallet))) {
      if (!getState().aiSharing.versionMismatch) backOff(dispatch);
      await dispatch(refreshQueue());
      return;
    }
  }

  // Lowered when the service still finds a batch too large (a proxy in front of it with a
  // smaller cap, say), so the next try sends fewer records.
  let maxRecords: number = api.MAX_RECORDS_PER_UPLOAD;
  // Checked before every batch: consent, the account or the flag can change mid-upload.
  while (mayUpload(getState(), wallet)) {
    const queued = await aiSharing.peek(wallet, api.MAX_RECORDS_PER_UPLOAD);
    if (queued.length === 0) break;
    const batch = nextBatch(queued, maxRecords);
    const response = await api.uploadTurns(wallet, batch);

    if (response.ok) {
      const kept = new Set(
        response.data.rejected.filter(r => RETRYABLE_REJECTIONS.has(r.reason)).map(r => r.recordId),
      );
      if (response.data.rejected.length > 0) {
        // Ids and reason codes only, never content.
        console.warn('[AI sharing] the service rejected records', response.data.rejected);
      }
      await aiSharing.ack(batch.map(r => r.recordId).filter(id => !kept.has(id)));
      dispatch(actions.uploadSucceeded());
      if (kept.size > 0) break;
      continue;
    }
    if (response.status === 0 && currentWallet() !== wallet) break;
    if (response.status === 403) {
      // No current consent for this wallet on the service: the consent text moved, or a
      // decision was made elsewhere. Stop, and let the next sync settle which decision stands.
      if (!checkVersionMismatch(dispatch, response)) dispatch(actions.setSyncedWallet(null));
      backOff(dispatch, response);
      break;
    }
    if (response.status === 413) {
      if (batch.length > 1) {
        maxRecords = Math.ceil(batch.length / 2);
        continue;
      }
      // Can't happen within the 128 KB record cap; if it does, the record can never upload.
      console.warn('[AI sharing] dropped a record larger than the service accepts', [
        batch[0].recordId,
      ]);
      await aiSharing.ack([batch[0].recordId]);
      continue;
    }
    // 400 (a malformed request: a client or signing bug, not the records), 401 (clock skew,
    // expired identity), 429, 503 (writes off), 5xx and network errors keep the records: they
    // are retried later and, at worst, expire from the queue after 7 days.
    backOff(dispatch, response);
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
    setVersionMismatch: state => {
      state.versionMismatch = true;
    },
    setSyncedWallet: (state, { payload }: PayloadAction<string | null>) => {
      state.syncedWallet = payload;
    },
    uploadSucceeded: state => {
      state.failures = 0;
      state.nextUploadAt = 0;
    },
    uploadFailed: (state, { payload }: PayloadAction<{ retryAfterSeconds?: number }>) => {
      state.failures += 1;
      const backoff = Math.min(MIN_BACKOFF_MS * 2 ** (state.failures - 1), MAX_BACKOFF_MS);
      const asked = (payload.retryAfterSeconds ?? 0) * 1000;
      state.nextUploadAt = Date.now() + Math.max(backoff, asked);
    },
    askDeleteConfirmation: state => {
      state.deleteStatus = 'confirming';
    },
    resetDelete: state => {
      state.deleteStatus = 'idle';
      state.deletedCount = null;
    },
    clearSharedTurns: state => {
      state.shared = { ...initialState.shared, generation: state.shared.generation + 1 };
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
        state.shared.generation += 1;
      })
      .addCase(deleteEverything.fulfilled, (state, { payload }) => {
        state.deleteStatus = 'deleted';
        state.deletedCount = payload;
      })
      .addCase(deleteEverything.rejected, state => {
        state.deleteStatus = 'failed';
      })
      .addCase(loadSharedTurns.pending, (state, { meta }) => {
        if (meta.arg.reset) state.shared.generation += 1;
        state.shared.status = 'loading';
      })
      .addCase(loadSharedTurns.fulfilled, (state, { payload }) => {
        if (payload.generation !== state.shared.generation) return;
        state.shared.turns = payload.reset
          ? payload.records
          : [...state.shared.turns, ...payload.records];
        state.shared.next = payload.next;
        state.shared.status = 'loaded';
      })
      .addCase(loadSharedTurns.rejected, state => {
        state.shared.status = 'failed';
      })
      .addCase(eraseSharedTurn.pending, (state, { meta }) => {
        state.shared.erasing.push(meta.arg);
      })
      .addCase(eraseSharedTurn.fulfilled, (state, { payload }) => {
        state.shared.turns = state.shared.turns.filter(t => t.recordId !== payload);
        state.shared.erasing = state.shared.erasing.filter(id => id !== payload);
      })
      .addCase(eraseSharedTurn.rejected, (state, { meta }) => {
        state.shared.erasing = state.shared.erasing.filter(id => id !== meta.arg);
      });
  },
});

export const actions = {
  ...slice.actions,
  refreshQueue,
  decide,
  deleteEverything,
  loadSharedTurns,
  eraseSharedTurn,
  flush,
};
export const reducer = slice.reducer;
