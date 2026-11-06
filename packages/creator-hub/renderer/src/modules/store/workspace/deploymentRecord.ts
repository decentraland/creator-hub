import type { Middleware } from '@reduxjs/toolkit';

import type { AppDispatch } from '#store';

import { deploy } from '../deployment';
import { actions as workspaceActions } from './index';

/** Records every deployment a content server accepts in the scene's `.editor/project.json`. */
export const deploymentRecordMiddleware: Middleware = store => next => action => {
  const result = next(action);
  if (deploy.fulfilled.match(action)) {
    void (store.dispatch as AppDispatch)(
      workspaceActions.recordDeployment({
        path: action.meta.arg.deployment.path,
        info: action.payload.info,
      }),
    );
  }
  return result;
};
