import {
  createSelector,
  createSlice,
  type ActionReducerMapBuilder,
  type AsyncThunk,
} from '@reduxjs/toolkit';

import type { Async } from '/shared/types/async';
import type {
  CreatorFundBanner,
  CreatorFundCycles,
  CreatorFundNews,
  CreatorFundPayouts,
  CreatorFundPlace,
  CreatorFundTerms,
  Cycle,
  Eligibility,
  EmailVerification,
  EmailVerificationRequest,
  Enrollment,
  EnrollmentRequest,
  Leaderboard,
  LeaderboardCycle,
  MyPlaces,
  PayoutWallet,
  PayoutWalletRequest,
} from '/shared/types/creator-fund';

import * as api from '/@/lib/creatorFundApi';
import type { CreatorFundResponse } from '/@/lib/creatorFundApi';
import { fetchMetrics, type LocationMetrics, type MetricLocation } from '/@/lib/metricsApi';
import { Worlds } from '/@/lib/worlds';
import type { AppState } from '/@/modules/store';
import { accountChanged } from '/@/modules/store/account';
import { getCreatorFundStart } from '/@/modules/store/featureFlags';
import { createAsyncThunk as createAppAsyncThunk } from '/@/modules/store/thunk';

import { formatCycleLabel } from './utils';

/** A failed response, kept whole so the UI can render its status and body. */
export type CreatorFundFailure = Extract<CreatorFundResponse<unknown>, { ok: false }>;

export type Resource<T> = Async<{ data: T | null; failure: CreatorFundFailure | null }>;

/** The analytics export for my places, keyed by place id. */
export type PlaceMetrics = { exported_at: string; byPlaceId: Record<string, LocationMetrics> };

const NOT_ENROLLED = 'not enrolled';

const createAsyncThunk = createAppAsyncThunk.withTypes<{ rejectValue: CreatorFundFailure }>();

const resource = <T>(): Resource<T> => ({ data: null, failure: null, status: 'idle', error: null });

const settle = <T>(
  response: CreatorFundResponse<T>,
  rejectWithValue: (failure: CreatorFundFailure) => unknown,
) => (response.ok ? response.data : (rejectWithValue(response) as never));

/** `GET /enrollment`, called on every visit to EARN; only the service's not-enrolled 404 resolves to `null`. */
export const fetchEnrollment = createAsyncThunk(
  'creatorFund/fetchEnrollment',
  async (_: void, { rejectWithValue }) => {
    const response = await api.getEnrollment();
    if (!response.ok && response.status === 404 && response.body?.message === NOT_ENROLLED) {
      return null;
    }
    return settle(response, rejectWithValue);
  },
);

/** `PUT /enrollment`: joins, or re-accepts newer terms. The answer becomes the enrollment. */
export const saveEnrollment = createAsyncThunk(
  'creatorFund/saveEnrollment',
  async (enrollment: EnrollmentRequest, { rejectWithValue }) =>
    settle(await api.putEnrollment(enrollment), rejectWithValue),
);

/** `GET /terms`. */
export const fetchTerms = createAsyncThunk(
  'creatorFund/fetchTerms',
  async (_: void, { rejectWithValue }) => settle(await api.getTerms(), rejectWithValue),
);

/** `GET /eligibility`. */
export const fetchEligibility = createAsyncThunk(
  'creatorFund/fetchEligibility',
  async (_: void, { rejectWithValue }) => settle(await api.getEligibility(), rejectWithValue),
);

/** `GET /cycles`. */
export const fetchCycles = createAsyncThunk(
  'creatorFund/fetchCycles',
  async (_: void, { rejectWithValue }) => settle(await api.getCycles(), rejectWithValue),
);

/**
 * `GET /leaderboard` for a closed cycle, or `'all'`. The answer is stamped with the cycle asked
 * for: the tab matches on it, and the service may echo it in another form (`"3"`, or `null` for
 * `all`), which would leave the tab waiting forever.
 */
export const fetchLeaderboard = createAsyncThunk(
  'creatorFund/fetchLeaderboard',
  async (cycle: LeaderboardCycle, { rejectWithValue }) => {
    const response = await api.getLeaderboard(cycle);
    if (!response.ok) return rejectWithValue(response);
    return { ...response.data, cycle_id: cycle };
  },
);

/** `GET /places?cycle=`: the user's places for a cycle, no paging; with no cycle the service picks one. */
export const fetchPlaces = createAsyncThunk(
  'creatorFund/fetchPlaces',
  async (cycle: number | undefined, { rejectWithValue }) =>
    settle(await api.getPlaces(cycle), rejectWithValue),
);

const locationOf = (place: CreatorFundPlace): MetricLocation => {
  const [x, y] = place.base_position.split(',').map(Number);
  return place.world && place.world_name ? { world: place.world_name, x, y } : { x, y };
};

/** The analytics API's (`METRICS_API_URL`) 30-day metrics for my places, read positionally into place ids. */
export const fetchPlaceMetrics = createAsyncThunk(
  'creatorFund/fetchPlaceMetrics',
  async (places: CreatorFundPlace[]): Promise<PlaceMetrics> => {
    const batch = await fetchMetrics(places.map(locationOf));
    return {
      exported_at: batch.exported_at,
      byPlaceId: Object.fromEntries(
        places.map((place, index) => [place.id, batch.locations[index]]),
      ),
    };
  },
);

/** The number of scenes a World holds, from the Worlds content server; asked once per World. */
export const fetchWorldSceneCount = createAppAsyncThunk(
  'creatorFund/fetchWorldSceneCount',
  async (worldName: string) =>
    (await new Worlds().fetchWorldScenes(worldName, { limit: 1, offset: 0 }))?.total ?? null,
  {
    condition: (worldName, { getState }) => !getState().creatorFund.worldScenesRequested[worldName],
  },
);

/** `GET /news`. */
export const fetchNews = createAsyncThunk(
  'creatorFund/fetchNews',
  async (_: void, { rejectWithValue }) => settle(await api.getNews(), rejectWithValue),
);

/** `GET /banner`; `null` data when there is none. */
export const fetchBanner = createAsyncThunk(
  'creatorFund/fetchBanner',
  async (_: void, { rejectWithValue }) => settle(await api.getBanner(), rejectWithValue),
);

/** `GET /payouts`. */
export const fetchPayouts = createAsyncThunk(
  'creatorFund/fetchPayouts',
  async (_: void, { rejectWithValue }) => settle(await api.getPayouts(), rejectWithValue),
);

/** `GET /payout-wallet`; a 404 resolves to `null` (no wallet yet). */
export const fetchPayoutWallet = createAsyncThunk(
  'creatorFund/fetchPayoutWallet',
  async (_: void, { rejectWithValue }) => {
    const response = await api.getPayoutWallet();
    if (!response.ok && response.status === 404) return null;
    return settle(response, rejectWithValue);
  },
);

/** `PUT /payout-wallet`: adds or changes it. The answer becomes the wallet. */
export const savePayoutWallet = createAsyncThunk(
  'creatorFund/savePayoutWallet',
  async (wallet: PayoutWalletRequest, { rejectWithValue }) =>
    settle(await api.putPayoutWallet(wallet), rejectWithValue),
);

/** `POST /enrollment/email-verification`: sends a code to the enrollment's email. */
export const sendEmailVerification = createAsyncThunk(
  'creatorFund/sendEmailVerification',
  async (_: void, { rejectWithValue }) =>
    settle(await api.postEmailVerification(), rejectWithValue),
);

/** `PUT /enrollment/email-verification`: confirms a code. The answer becomes the enrollment. */
export const confirmEmailVerification = createAsyncThunk(
  'creatorFund/confirmEmailVerification',
  async (verification: EmailVerificationRequest, { rejectWithValue }) =>
    settle(await api.putEmailVerification(verification), rejectWithValue),
);

type Resources = {
  enrollment: Resource<Enrollment>;
  enrollmentSave: Resource<Enrollment>;
  terms: Resource<CreatorFundTerms>;
  eligibility: Resource<Eligibility>;
  cycles: Resource<CreatorFundCycles>;
  leaderboard: Resource<Leaderboard>;
  places: Resource<MyPlaces>;
  placeMetrics: Resource<PlaceMetrics>;
  news: Resource<CreatorFundNews>;
  banner: Resource<CreatorFundBanner>;
  payouts: Resource<CreatorFundPayouts>;
  payoutWallet: Resource<PayoutWallet>;
  payoutWalletSave: Resource<PayoutWallet>;
  emailVerification: Resource<EmailVerification>;
  emailVerificationConfirm: Resource<Enrollment>;
};

export type CreatorFundState = Resources & {
  /** The latest request per resource; an answer to any older one is dropped. */
  latestRequestIds: Partial<Record<keyof Resources, string>>;
  /** Scenes per World name, for the multi-scene place label. */
  worldSceneCounts: Record<string, number>;
  worldScenesRequested: Record<string, true>;
};

export const initialState: CreatorFundState = {
  enrollment: resource(),
  enrollmentSave: resource(),
  terms: resource(),
  eligibility: resource(),
  cycles: resource(),
  leaderboard: resource(),
  places: resource(),
  placeMetrics: resource(),
  news: resource(),
  banner: resource(),
  payouts: resource(),
  payoutWallet: resource(),
  payoutWalletSave: resource(),
  emailVerification: resource(),
  emailVerificationConfirm: resource(),
  latestRequestIds: {},
  worldSceneCounts: {},
  worldScenesRequested: {},
};

type Key = keyof Resources;
type ThunkConfig = typeof fetchTerms extends AsyncThunk<any, any, infer Config> ? Config : never;
type AnyThunk = AsyncThunk<any, any, ThunkConfig>;
type Fulfilled<A extends AnyThunk> = ReturnType<A['fulfilled']>;

function track<A extends AnyThunk>(
  builder: ActionReducerMapBuilder<CreatorFundState>,
  key: Key,
  thunk: A,
  onFulfilled: (
    state: CreatorFundState,
    payload: Fulfilled<A>['payload'],
    arg: Fulfilled<A>['meta']['arg'],
  ) => void = (state, payload) => {
    state[key].data = payload;
  },
) {
  builder
    .addCase(thunk.pending, (state, action) => {
      state.latestRequestIds[key] = action.meta.requestId;
      state[key].status = 'loading';
      state[key].error = null;
      state[key].failure = null;
    })
    .addCase(thunk.fulfilled, (state, action) => {
      if (state.latestRequestIds[key] !== action.meta.requestId) return;
      onFulfilled(state, action.payload, action.meta.arg);
      state[key].status = 'succeeded';
    })
    .addCase(thunk.rejected, (state, action) => {
      if (state.latestRequestIds[key] !== action.meta.requestId) return;
      state[key].status = 'failed';
      state[key].failure = (action.payload as CreatorFundFailure | undefined) ?? null;
      state[key].error =
        (action.payload as CreatorFundFailure | undefined)?.error ??
        action.error.message ??
        'Request failed';
    });
}

const slice = createSlice({
  name: 'creatorFund',
  initialState,
  reducers: {
    clearState: () => initialState,
  },
  extraReducers: builder => {
    builder.addCase(accountChanged, () => initialState);
    track(builder, 'enrollment', fetchEnrollment);
    track(builder, 'enrollmentSave', saveEnrollment, (state, payload) => {
      state.enrollmentSave.data = payload;
      state.enrollment.data = payload;
      state.enrollment.status = 'succeeded';
    });
    track(builder, 'terms', fetchTerms);
    track(builder, 'eligibility', fetchEligibility);
    track(builder, 'cycles', fetchCycles);
    track(builder, 'leaderboard', fetchLeaderboard);
    track(builder, 'places', fetchPlaces);
    track(builder, 'placeMetrics', fetchPlaceMetrics);
    track(builder, 'news', fetchNews);
    track(builder, 'banner', fetchBanner);
    track(builder, 'payouts', fetchPayouts);
    track(builder, 'payoutWallet', fetchPayoutWallet);
    track(builder, 'payoutWalletSave', savePayoutWallet, (state, payload) => {
      state.payoutWalletSave.data = payload;
      state.payoutWallet.data = payload;
      state.payoutWallet.status = 'succeeded';
    });
    track(builder, 'emailVerification', sendEmailVerification);
    track(builder, 'emailVerificationConfirm', confirmEmailVerification, (state, payload) => {
      state.emailVerificationConfirm.data = payload;
      state.enrollment.data = payload;
    });
    builder
      .addCase(fetchWorldSceneCount.pending, (state, action) => {
        state.worldScenesRequested[action.meta.arg] = true;
      })
      .addCase(fetchWorldSceneCount.fulfilled, (state, action) => {
        if (action.payload !== null) state.worldSceneCounts[action.meta.arg] = action.payload;
      });
  },
});

const getCreatorFund = (state: AppState) => state.creatorFund;
const getEnrollment = (state: AppState) => state.creatorFund.enrollment.data;
const getTerms = (state: AppState) => state.creatorFund.terms.data;
const getCycles = (state: AppState) => state.creatorFund.cycles.data;

/** An active enrollment on a terms version other than the current one. */
const needsReaccept = createSelector(
  [getEnrollment, getTerms],
  (enrollment, terms) =>
    !!enrollment &&
    !!terms &&
    enrollment.status === 'active' &&
    enrollment.terms_version !== terms.version,
);

/** The cycles from the program start on, newest first; the API promises no order. */
const getSortedCycles = createSelector([getCycles, getCreatorFundStart], (cycles, start) =>
  (cycles?.cycles ?? [])
    .filter(cycle => start === null || Date.parse(cycle.start_at) >= start)
    .sort((a, b) => b.start_at.localeCompare(a.start_at)),
);

/** The newest closed cycle, the leaderboard's default; `null` before any cycle closes. */
const getLatestClosedCycle = createSelector(
  getSortedCycles,
  cycles => cycles.find(cycle => cycle.status === 'closed') ?? null,
);

/** The first cycle, the one that starts earliest; `null` while none is listed. */
const getFirstCycle = createSelector(
  getSortedCycles,
  (cycles): Cycle | null => cycles.at(-1) ?? null,
);

/** My Places' cycles: the running one first, then the closed ones newest first; never an upcoming one. */
const getMyPlacesCycles = createSelector(getSortedCycles, cycles => [
  ...cycles.filter(cycle => cycle.status === 'running'),
  ...cycles.filter(cycle => cycle.status === 'closed'),
]);

/** My Places' default: the running cycle, else the latest closed one, else none. */
const getDefaultPlacesCycle = createSelector(
  getMyPlacesCycles,
  (cycles): Cycle | null => cycles[0] ?? null,
);

/** The cycle the first payout follows: the running one, else the next upcoming, else none. */
const getFirstPayoutCycle = createSelector(
  getSortedCycles,
  (cycles): Cycle | null =>
    cycles.find(cycle => cycle.status === 'running') ??
    cycles.filter(cycle => cycle.status === 'upcoming').at(-1) ??
    null,
);

/** A cycle's label in the app's locale, or `null` for an unknown id. */
const getCycleLabel = createSelector(
  [getCycles, (state: AppState) => state.translation.locale, (_: AppState, id: number) => id],
  (cycles, locale, id) => {
    const cycle = cycles?.cycles.find(candidate => candidate.id === id);
    return cycle ? formatCycleLabel(cycle, locale) : null;
  },
);

export const selectors = {
  getCreatorFund,
  needsReaccept,
  getSortedCycles,
  getLatestClosedCycle,
  getFirstCycle,
  getMyPlacesCycles,
  getDefaultPlacesCycle,
  getFirstPayoutCycle,
  getCycleLabel,
};
export const actions = {
  ...slice.actions,
  fetchEnrollment,
  saveEnrollment,
  fetchTerms,
  fetchEligibility,
  fetchCycles,
  fetchLeaderboard,
  fetchPlaces,
  fetchPlaceMetrics,
  fetchWorldSceneCount,
  fetchNews,
  fetchBanner,
  fetchPayouts,
  fetchPayoutWallet,
  savePayoutWallet,
  sendEmailVerification,
  confirmEmailVerification,
};
export const reducer = slice.reducer;
