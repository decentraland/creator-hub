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
import { createAnalyticsMiddleware } from './analytics/middleware';

const analytics = createAnalyticsMiddleware(import.meta.env.VITE_EDITOR_SEGMENT_API_KEY);

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
  middleware: getDefaultMiddleware => getDefaultMiddleware().concat(logger).concat(analytics),
});

const isDevelopment = true; // todo

if (isDevelopment) {
  const _window = window as any;
  _window.getState = store.getState;
}

export type GetState = typeof store.getState;
export type AppState = ReturnType<GetState>;
export type AppDispatch = typeof store.dispatch;
export type ThunkAction = (dispatch: AppDispatch, getState: GetState) => void;
export const useDispatch: () => AppDispatch = formerUseDispuseDispatch;
export const useSelector: TypedUseSelectorHook<AppState> = formerUseSelector;
export const createSelector = createDraftSafeSelector.withTypes<AppState>();

// dispatch start up actions
async function start() {
  try {
    // fetch app version
    await store.dispatch(editorActions.fetchVersion());
    // install editor dependencies
    const install = store.dispatch(editorActions.install());
    await install.unwrap(); // .unwrap() to make it throw if thunk is rejected

    // start app
    await Promise.all([
      // start inspector
      store.dispatch(editorActions.startInspector()),
      // load workspace
      store.dispatch(workspaceActions.getWorkspace()),
    ]);
  } catch (error: any) {
    console.error(`[Renderer]: Failed to start up error=${error.message}`);
  }
}

// kick it off
void start();

export { store };
