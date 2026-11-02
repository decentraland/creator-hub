import { useCallback } from 'react';

import { actions, type Deployment } from '/@/modules/store/deployment';
import { deriveOverallStatus as _deriveOverallStatus } from '/@/modules/store/deployment/utils';
import { useDispatch, useSelector } from '#store';

export const useDeploy = () => {
  const dispatch = useDispatch();
  const deployments = useSelector(state => state.deployment.deployments);
  const history = useSelector(state => state.deployment.history);

  const getDeployment = useCallback(
    (id: string): Deployment | undefined => deployments[id],
    [deployments],
  );

  const getDeploymentHistory = useCallback(
    (path: string): Deployment[] => history[path] || [],
    [history],
  );

  const executeDeployment = useCallback(
    async (path: string) => {
      dispatch(actions.executeDeployment(path));
    },
    [dispatch],
  );

  const removeDeployment = useCallback(
    (path: string) => {
      dispatch(actions.removeDeployment({ path }));
    },
    [dispatch],
  );

  const deriveOverallStatus = useCallback((deployment: Deployment) => {
    if (deployment.status === 'failed') {
      return 'failed';
    }
    return _deriveOverallStatus(deployment.componentsStatus);
  }, []);

  return {
    deployments,
    history,
    getDeployment,
    getDeploymentHistory,
    executeDeployment,
    deriveOverallStatus,
    removeDeployment,
  };
};
