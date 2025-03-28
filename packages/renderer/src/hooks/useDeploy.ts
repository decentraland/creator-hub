import { useCallback } from 'react';
import type { ChainId } from '@dcl/schemas';

import { useDispatch, useSelector } from '#store';

import { actions, type Deployment } from '/@/modules/store/deployment';
import { deriveOverallStatus, checkDeploymentCompletion } from '/@/modules/store/deployment/utils';

export const useDeploy = () => {
  const dispatch = useDispatch();
  const deployments = useSelector(state => state.deployment.deployments);

  const getDeployment = useCallback(
    (id: string): Deployment | undefined => deployments[id],
    [deployments],
  );

  const initializeDeployment = useCallback(
    async (path: string, port: number, chainId: ChainId, wallet: string) => {
      const payload = { path, port, chainId, wallet };
      dispatch(actions.initializeDeployment(payload));
    },
    [dispatch],
  );

  const executeDeployment = useCallback(
    async (path: string) => {
      dispatch(actions.executeDeployment(path));
    },
    [dispatch],
  );

  const executeDeploymentWithRetry = useCallback(
    async (path: string) => {
      dispatch(actions.executeDeploymentWithRetry(path));
    },
    [dispatch],
  );

  const removeDeployment = useCallback(
    (path: string) => {
      dispatch(actions.removeDeployment({ path }));
    },
    [dispatch],
  );

  const overallStatus = useCallback(
    (deployment: Deployment) => deriveOverallStatus(deployment.componentsStatus),
    [],
  );

  const isDeployFinishing = useCallback(
    (deployment: Deployment) => checkDeploymentCompletion(deployment.componentsStatus),
    [],
  );

  return {
    deployments,
    getDeployment,
    initializeDeployment,
    executeDeployment,
    executeDeploymentWithRetry,
    overallStatus,
    isDeployFinishing,
    removeDeployment,
  };
};
