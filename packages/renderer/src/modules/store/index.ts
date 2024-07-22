import { configureStore, createDraftSafeSelector } from '@reduxjs/toolkit';
import {
  type TypedUseSelectorHook,
  useSelector as formerUseSelector,
  useDispatch as formerUseDispuseDispatch,
} from 'react-redux';
import logger from 'redux-logger';
import { reducer as editorReducer, actions as editorActions } from './editor';
import { reducer as snackbarReducer } from './snackbar';
import { reducer as translationReducer } from './translation';
import { reducer as workspaceReducer, actions as workspaceActions } from './workspace';

export function createRootReducer() {
  return {
    editor: editorReducer,
    snackbar: snackbarReducer,
    translation: translationReducer,
    workspace: workspaceReducer,
  };
}

// check: https://redux.js.org/usage/migrating-to-modern-redux#store-setup-with-configurestore
// for more info in the future...
const store = configureStore({
  reducer: createRootReducer(),
  middleware: getDefaultMiddleware => getDefaultMiddleware().concat(logger),
});

const isDevelopment = true; // todo

if (isDevelopment) {
  const _window = window as any;
  _window.getState = store.getState;
}

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export const useDispatch: () => AppDispatch = formerUseDispuseDispatch;
export const useSelector: TypedUseSelectorHook<RootState> = formerUseSelector;
export const createSelector = createDraftSafeSelector.withTypes<RootState>();

// dispatch start up actions
store.dispatch(editorActions.startInspector());
store.dispatch(workspaceActions.getWorkspace());

export { store };
