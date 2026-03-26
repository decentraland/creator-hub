import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import type { RootState } from '../store';

export interface EntityValidationState {
  entitiesWithErrors: number[];
}

export const initialState: EntityValidationState = {
  entitiesWithErrors: [],
};

export const entityValidation = createSlice({
  name: 'entity-validation',
  initialState,
  reducers: {
    setEntitiesWithErrors: (state, { payload }: PayloadAction<number[]>) => {
      state.entitiesWithErrors = payload;
    },
  },
});

export const { setEntitiesWithErrors } = entityValidation.actions;

export const getEntitiesWithErrors = (state: RootState): number[] =>
  state.entityValidation.entitiesWithErrors;

export default entityValidation.reducer;
