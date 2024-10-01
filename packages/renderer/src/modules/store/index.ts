import { configureStore, createDraftSafeSelector } from '@reduxjs/toolkit';
import {
  type TypedUseSelectorHook,
  useSelector as formerUseSelector,
  useDispatch as formerUseDispuseDispatch,
} from 'react-redux';
import logger from 'redux-logger';
import { createAnalyticsMiddleware } from './analytics/middleware';
import * as editor from './editor';
import * as snackbar from './snackbar';
import * as translations from './translation';
import * as workspace from './workspace';
import * as analytics from './analytics';
import * as ens from './ens';

export function createRootReducer() {
  return {
    editor: editor.reducer,
    snackbar: snackbar.reducer,
    translation: translations.reducer,
    workspace: workspace.reducer,
    analytics: analytics.reducer,
    ens: ens.reducer,
  };
}

// check: https://redux.js.org/usage/migrating-to-modern-redux#store-setup-with-configurestore
// for more info in the future...
const store = configureStore({
  reducer: createRootReducer(),
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware().concat(logger).concat(createAnalyticsMiddleware()),
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
    // fetch app version and user id
    await Promise.all([
      store.dispatch(editor.actions.fetchVersion()),
      store.dispatch(analytics.actions.fetchAnonymousId()),
    ]);

    // install editor dependencies
    const install = store.dispatch(editor.actions.install());
    await install.unwrap(); // .unwrap() to make it throw if thunk is rejected

    // start app
    await Promise.all([
      // start inspector
      store.dispatch(editor.actions.startInspector()),
      // load workspace
      store.dispatch(workspace.actions.getWorkspace()),
    ]);
  } catch (error: any) {
    console.error(`[Renderer]: Failed to start up error=${error.message}`);
  }
}

// kick it off
void start();

export { store };
