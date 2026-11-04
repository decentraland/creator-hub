import { createAction } from '@reduxjs/toolkit';

/** Dispatched whenever the signed-in wallet changes; every wallet-scoped slice resets on it. */
export const accountChanged = createAction('account/changed');
