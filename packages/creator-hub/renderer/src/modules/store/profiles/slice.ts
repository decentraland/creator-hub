import { createAsyncThunk, createSlice, createSelector } from '@reduxjs/toolkit';
import type { Avatar } from '@dcl/schemas';
import type { AppState } from '/@/modules/store';
import Profiles from '/@/lib/profile';

export type ProfileData = {
  avatar: Avatar | undefined;
  status: 'loading' | 'succeeded' | 'not_found';
};

export type ProfilesState = {
  data: Record<string, ProfileData>;
};

export const initialState: ProfilesState = {
  data: {},
};

export const fetchProfile = createAsyncThunk(
  'profiles/fetchProfile',
  async ({ address }: { address: string }) => {
    const avatar = await Profiles.fetchProfile(address);
    return { address, avatar };
  },
);

const slice = createSlice({
  name: 'profiles',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchProfile.pending, (state, action) => {
        const { address } = action.meta.arg;
        state.data[address] = { avatar: undefined, status: 'loading' };
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        const { address, avatar } = action.payload;
        state.data[address] = { avatar, status: avatar ? 'succeeded' : 'not_found' };
      })
      .addCase(fetchProfile.rejected, (state, action) => {
        const { address } = action.meta.arg;
        state.data[address] = { avatar: undefined, status: 'not_found' };
      });
  },
});

const getProfilesState = (state: AppState) => state.profiles;

const getProfile = createSelector(
  [getProfilesState, (_state: AppState, address: string) => address],
  (profilesState, address) => profilesState.data[address],
);

export const actions = {
  ...slice.actions,
  fetchProfile,
};

export const reducer = slice.reducer;

export const selectors = {
  ...slice.selectors,
  getProfile,
};
