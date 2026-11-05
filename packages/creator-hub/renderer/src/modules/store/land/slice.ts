import type { Tile } from 'react-tile-map/dist/lib/common';
import { createAsyncThunk, createSlice, createSelector } from '@reduxjs/toolkit';
import { captureException } from '@sentry/electron/renderer';
import type { AtlasTileProps } from 'decentraland-ui2/dist/components/Atlas/Atlas.types';
import type { Async } from '/shared/types/async';
import { config } from '/@/config';
import { fetch } from '/shared/fetch';
import {
  colorByRole,
  coordsToId,
  Lands,
  LandType,
  Rentals,
  type Authorization,
  type Land,
  type Rental,
} from '/@/lib/land';
import { accountChanged, isSignedInAccount } from '/@/modules/store/account';
import { settleRequest, settleRequestAndOlder } from '/@/modules/store/requests';

// actions
export const fetchTiles = createAsyncThunk('land/fetchTiles', async () => {
  const tilesFetch = await fetch(`${config.get('ATLAS_SERVER_API_URL')}/tiles`);
  const tilesJson: {
    ok: boolean;
    data: Record<string, AtlasTileProps>;
    error: string;
  } = await tilesFetch.json();

  return tilesJson.data;
});

export const fetchRentalsList = async (address: string) => {
  const RentalsAPI = new Rentals();
  return RentalsAPI.fetchRentalTokenIds(address);
};

export const fetchLandList = createAsyncThunk(
  'land/fetchLandList',
  async ({ address }: { address: string }) => {
    const LandsAPI = new Lands();

    const rentals = await fetchRentalsList(address);
    const tenantTokenIds = rentals.tenantRentals.map(rental => rental.tokenId);
    const lessorTokenIds = rentals.lessorRentals.map(rental => rental.tokenId);

    const [land, authorizations]: [Land[], Authorization[]] = await LandsAPI.fetchLand(
      address,
      tenantTokenIds,
      lessorTokenIds,
    );

    return {
      land,
      authorizations,
      rentals: rentals.tenantRentals.concat(rentals.lessorRentals),
    };
  },
  { condition: isSignedInAccount },
);

// selectors
const getLands = (state: LandState) => state.data;
const getTiles = (state: LandState) => state.tiles;

const getCoordsByEstateId = createSelector([getTiles], tiles => {
  const result: Record<string, string[]> = {};
  for (const tile of Object.values(tiles)) {
    if (tile.estateId) {
      const exists = tile.estateId in result;
      if (!exists) {
        result[tile.estateId] = [];
      }
      result[tile.estateId].push(coordsToId(tile.x, tile.y));
    }
  }
  return result;
});

const getLandTiles = createSelector(
  [getLands, getTiles, getCoordsByEstateId],
  (lands, tiles, coordsByEstateId) => {
    const result: Record<string, LandTile> = {};
    // The publish picker offers these tiles: a land the Catalyst would refuse the
    // deployment for (e.g. one the wallet rented out) is not offered at all.
    for (const land of lands) {
      if (!land.deployable) continue;
      if (land.type === LandType.PARCEL) {
        const id = coordsToId(land.x!, land.y!);
        result[id] = {
          color: colorByRole[land.role],
          land,
        };
      } else {
        const estateId = land.id;
        const coords = coordsByEstateId[estateId];
        if (coords) {
          for (const coord of coords) {
            const tile = tiles[coord];
            if (tile) {
              result[coord] = {
                color: colorByRole[land.role],
                top: !!tile.top,
                left: !!tile.left,
                topLeft: !!tile.topLeft,
                land,
              };
            }
          }
        }
      }
    }
    return result;
  },
);

// state
export type LandTile = Tile & { land: Land };
export type LandState = {
  data: Land[];
  authorizations: Authorization[];
  rentals: Rental[];
  tiles: Record<string, AtlasTileProps>;
  error: string | null;
  /** Land list requests still in flight for the current account, oldest first. */
  requestIds: string[];
};

export const initialState: Async<LandState> = {
  data: [],
  authorizations: [],
  rentals: [],
  tiles: {},
  status: 'idle',
  error: null,
  requestIds: [],
};

// slice
export const slice = createSlice({
  name: 'land',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(accountChanged, state => ({ ...initialState, tiles: state.tiles }))
      .addCase(fetchLandList.pending, (state, action) => {
        state.status = 'loading';
        state.requestIds.push(action.meta.requestId);
      })
      .addCase(fetchLandList.fulfilled, (state, action) => {
        if (!settleRequestAndOlder(state.requestIds, action.meta.requestId)) return;
        state.data = [...action.payload.land];
        state.authorizations = action.payload.authorizations;
        state.rentals = action.payload.rentals;
        state.status = 'succeeded';
      })
      .addCase(fetchTiles.fulfilled, (state, action) => {
        state.tiles = { ...action.payload };
      })
      .addCase(fetchLandList.rejected, (state, action) => {
        if (!settleRequest(state.requestIds, action.meta.requestId)) return;
        state.status = state.requestIds.length
          ? 'loading'
          : state.data.length
            ? 'succeeded'
            : 'failed';
        state.error = action.error.message || 'Failed to fetch land list';
        captureException(action.error, {
          tags: { source: 'land', event: 'fetch-land-list' },
        });
      })
      .addCase(fetchTiles.rejected, (_state, action) => {
        captureException(action.error, {
          tags: { source: 'land', event: 'fetch-tiles' },
        });
      });
  },
});

// exports
export const actions = { ...slice.actions, fetchLandList };
export const reducer = slice.reducer;
export const selectors = {
  ...slice.selectors,
  getLands,
  getTiles,
  getCoordsByEstateId,
  getLandTiles,
};
