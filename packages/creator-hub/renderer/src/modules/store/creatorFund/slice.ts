import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { Status } from '/shared/types/async';

import type { AnalyticsPlace } from '/@/lib/analyticsLocations';
import { collectAnalyticsPlaces } from '/@/lib/analyticsLocations';
import type {
  CreatorEligibility,
  Enrollment,
  FundPlaceKey,
  Payout,
  PayoutWallet,
  PlaceEligibility,
  SimulatedCreator,
} from '/@/lib/creatorFund';
import {
  TERMS_VERSION,
  creatorFundApi,
  fundKeyOfLocation,
  isBannerDismissed,
  mockControls,
  setBannerDismissed,
} from '/@/lib/creatorFund';
import { Worlds } from '/@/lib/worlds';
import type { AppState } from '/@/modules/store';
import { fetchLandList } from '/@/modules/store/land';
import { fetchAllDeployedWorlds } from '/@/modules/store/management/utils';
import { createAsyncThunk } from '/@/modules/store/thunk';

import FALLBACK_THUMBNAIL from '/assets/images/scene-thumbnail-fallback.png';

/**
 * The Creator Fund, as one creator sees it: whether they joined, their payout
 * wallet and history, and which of their places can take part.
 *
 * Every answer comes from `creatorFundApi`, which is the POC's mock backoffice.
 */

export const loadCreatorFund = createAsyncThunk(
  'creatorFund/load',
  async ({ address }: { address: string }) => {
    const [enrollment, payoutWallet] = await Promise.all([
      creatorFundApi.getEnrollment(address),
      creatorFundApi.getPayoutWallet(address),
    ]);
    return { address, enrollment, payoutWallet };
  },
);

export const checkEligibility = createAsyncThunk(
  'creatorFund/checkEligibility',
  async ({ address }: { address: string }) => creatorFundApi.getCreatorEligibility(address),
);

export const joinCreatorFund = createAsyncThunk(
  'creatorFund/join',
  async ({ address }: { address: string }) => creatorFundApi.enroll(address, TERMS_VERSION),
);

/** Asks only about places not answered yet: a tile's label never flickers on revisit. */
export const fetchPlacesEligibility = createAsyncThunk(
  'creatorFund/fetchPlacesEligibility',
  async (places: Array<{ key: FundPlaceKey; title: string | null }>, { getState }) => {
    const known = getState().creatorFund.places;
    const missing = [...new Map(places.map(place => [place.key, place])).values()].filter(
      place => !known[place.key],
    );
    return missing.length ? creatorFundApi.getPlacesEligibility(missing) : [];
  },
);

/**
 * Every scene the creator owns or operates, for the fund page's list. Fetched
 * here rather than read off Manage, whose list is narrowed by its own filters.
 */
export const fetchCreatorPlaces = createAsyncThunk(
  'creatorFund/fetchCreatorPlaces',
  async ({ address }: { address: string }, { dispatch }) => {
    const [projects, { land }] = await Promise.all([
      fetchAllDeployedWorlds(new Worlds(), address),
      dispatch(fetchLandList({ address })).unwrap(),
    ]);
    const places = await collectAnalyticsPlaces(projects, land, FALLBACK_THUMBNAIL);
    await dispatch(
      fetchPlacesEligibility(
        places.map(place => ({ key: fundKeyOfLocation(place.location), title: place.name })),
      ),
    );
    return places;
  },
);

export const savePayoutWallet = createAsyncThunk(
  'creatorFund/savePayoutWallet',
  async ({ address, wallet }: { address: string; wallet: string }) =>
    creatorFundApi.setPayoutWallet(address, wallet),
);

export const fetchPayouts = createAsyncThunk(
  'creatorFund/fetchPayouts',
  async ({ address }: { address: string }) => creatorFundApi.getPayouts(address),
);

export const dismissBanner = createAsyncThunk('creatorFund/dismissBanner', async () =>
  setBannerDismissed(true),
);

export const simulateCreator = createAsyncThunk(
  'creatorFund/simulateCreator',
  async (simulated: SimulatedCreator) => {
    mockControls.setSimulatedCreator(simulated);
    return simulated;
  },
);

export const resetDemo = createAsyncThunk('creatorFund/resetDemo', async () =>
  mockControls.reset(),
);

// state
export type CreatorFundState = {
  /** The wallet `enrollment` and `payoutWallet` belong to. */
  address: string | null;
  loadStatus: Status;
  enrollment: Enrollment | null;
  eligibility: CreatorEligibility | null;
  eligibilityStatus: Status;
  joinStatus: Status;
  payoutWallet: PayoutWallet | null;
  payoutWalletStatus: Status;
  payouts: Payout[];
  payoutsStatus: Status;
  places: Partial<Record<FundPlaceKey, PlaceEligibility>>;
  creatorPlaces: AnalyticsPlace[];
  creatorPlacesStatus: Status;
  bannerDismissed: boolean;
  /** The Manage page's "In Creator Fund" filter. */
  showInFundOnly: boolean;
  simulated: SimulatedCreator;
  error: string | null;
};

const initialState = (): CreatorFundState => ({
  address: null,
  loadStatus: 'idle',
  enrollment: null,
  eligibility: null,
  eligibilityStatus: 'idle',
  joinStatus: 'idle',
  payoutWallet: null,
  payoutWalletStatus: 'idle',
  payouts: [],
  payoutsStatus: 'idle',
  places: {},
  creatorPlaces: [],
  creatorPlacesStatus: 'idle',
  bannerDismissed: isBannerDismissed(),
  showInFundOnly: false,
  simulated: mockControls.getSimulatedCreator(),
  error: null,
});

const slice = createSlice({
  name: 'creatorFund',
  initialState,
  reducers: {
    setShowInFundOnly: (state, action: PayloadAction<boolean>) => {
      state.showInFundOnly = action.payload;
    },
    /** Lets the join modal start over: a stale "not eligible" must not greet the next attempt. */
    resetEligibility: state => {
      state.eligibility = null;
      state.eligibilityStatus = 'idle';
      state.joinStatus = 'idle';
    },
  },
  extraReducers: builder => {
    builder
      .addCase(loadCreatorFund.pending, (state, action) => {
        if (state.address !== action.meta.arg.address) {
          Object.assign(state, {
            ...initialState(),
            places: state.places,
            address: action.meta.arg.address,
          });
        }
        state.loadStatus = 'loading';
      })
      .addCase(loadCreatorFund.fulfilled, (state, action) => {
        state.enrollment = action.payload.enrollment;
        state.payoutWallet = action.payload.payoutWallet;
        state.loadStatus = 'succeeded';
      })
      .addCase(loadCreatorFund.rejected, (state, action) => {
        state.loadStatus = 'failed';
        state.error = action.error.message ?? null;
      })
      .addCase(checkEligibility.pending, state => {
        state.eligibility = null;
        state.eligibilityStatus = 'loading';
      })
      .addCase(checkEligibility.fulfilled, (state, action) => {
        state.eligibility = action.payload;
        state.eligibilityStatus = 'succeeded';
      })
      .addCase(checkEligibility.rejected, (state, action) => {
        state.eligibilityStatus = 'failed';
        state.error = action.error.message ?? null;
      })
      .addCase(joinCreatorFund.pending, state => {
        state.joinStatus = 'loading';
      })
      .addCase(joinCreatorFund.fulfilled, (state, action) => {
        state.enrollment = action.payload;
        state.joinStatus = 'succeeded';
      })
      .addCase(joinCreatorFund.rejected, (state, action) => {
        state.joinStatus = 'failed';
        state.error = action.error.message ?? null;
      })
      .addCase(fetchPlacesEligibility.fulfilled, (state, action) => {
        for (const place of action.payload) {
          state.places[place.place_id as FundPlaceKey] = place;
        }
      })
      .addCase(fetchCreatorPlaces.pending, state => {
        state.creatorPlacesStatus = 'loading';
      })
      .addCase(fetchCreatorPlaces.fulfilled, (state, action) => {
        state.creatorPlaces = action.payload;
        state.creatorPlacesStatus = 'succeeded';
      })
      .addCase(fetchCreatorPlaces.rejected, (state, action) => {
        state.creatorPlacesStatus = 'failed';
        state.error = action.error.message ?? null;
      })
      .addCase(savePayoutWallet.pending, state => {
        state.payoutWalletStatus = 'loading';
      })
      .addCase(savePayoutWallet.fulfilled, (state, action) => {
        state.payoutWallet = action.payload;
        state.payoutWalletStatus = 'succeeded';
      })
      .addCase(savePayoutWallet.rejected, (state, action) => {
        state.payoutWalletStatus = 'failed';
        state.error = action.error.message ?? null;
      })
      .addCase(fetchPayouts.pending, state => {
        state.payoutsStatus = 'loading';
      })
      .addCase(fetchPayouts.fulfilled, (state, action) => {
        state.payouts = action.payload;
        state.payoutsStatus = 'succeeded';
      })
      .addCase(fetchPayouts.rejected, (state, action) => {
        state.payoutsStatus = 'failed';
        state.error = action.error.message ?? null;
      })
      .addCase(dismissBanner.fulfilled, state => {
        state.bannerDismissed = true;
      })
      .addCase(simulateCreator.fulfilled, (state, action) => {
        state.simulated = action.payload;
        state.eligibility = null;
        state.eligibilityStatus = 'idle';
      })
      .addCase(resetDemo.fulfilled, state => ({
        ...initialState(),
        address: state.address,
        loadStatus: state.loadStatus,
        places: state.places,
        creatorPlaces: state.creatorPlaces,
        creatorPlacesStatus: state.creatorPlacesStatus,
      }));
  },
});

export enum PlaceFundStatus {
  IN_FUND = 'in_fund',
  ELIGIBLE = 'eligible',
  NOT_ELIGIBLE = 'not_eligible',
}

/** `null` until the backoffice has answered for the place. */
function getPlaceFundStatus(state: AppState, key: FundPlaceKey): PlaceFundStatus | null {
  const place = state.creatorFund.places[key];
  if (!place) return null;
  if (!place.opt_in.eligible) return PlaceFundStatus.NOT_ELIGIBLE;
  return state.creatorFund.enrollment ? PlaceFundStatus.IN_FUND : PlaceFundStatus.ELIGIBLE;
}

const getPlaceEligibility = (state: AppState, key: FundPlaceKey): PlaceEligibility | undefined =>
  state.creatorFund.places[key];

export const selectors = { getPlaceFundStatus, getPlaceEligibility };

export const actions = {
  ...slice.actions,
  loadCreatorFund,
  checkEligibility,
  joinCreatorFund,
  fetchPlacesEligibility,
  fetchCreatorPlaces,
  savePayoutWallet,
  fetchPayouts,
  dismissBanner,
  simulateCreator,
  resetDemo,
};

export const reducer = slice.reducer;
