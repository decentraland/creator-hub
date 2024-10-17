import { useCallback, useEffect, useState } from 'react';
import { settings } from '#preload';
import { DEPENDENCY_UPDATE_STRATEGY } from '/shared/types/settings';

export const useSettings = () => {
  const [scenesPath, setScenesPath] = useState('');
  const [updateDependenciesStrategy, setUpdateDependenciesStrategy] =
    useState<DEPENDENCY_UPDATE_STRATEGY>(DEPENDENCY_UPDATE_STRATEGY.NOTIFY);

  const handleUpdateScenesPath = useCallback(async (path: string) => {
    await settings.setScenesPath(path);
    setScenesPath(path);
  }, []);

  const handleUpdateDependenciesStrategy = useCallback(
    async (strategy: DEPENDENCY_UPDATE_STRATEGY) => {
      await settings.setUpdateDependenciesStrategy(strategy);
      setUpdateDependenciesStrategy(strategy);
    },
    [],
  );

  useEffect(() => {
    async function getAppSettings() {
      const path = await settings.getScenesPath();
      const strategy = await settings.getUpdateDependenciesStrategy();
      setScenesPath(path);
      setUpdateDependenciesStrategy(strategy);
    }

    getAppSettings();
  }, []);

  return {
    scenesPath,
    updateDependenciesStrategy,
    setScenesPath: handleUpdateScenesPath,
    setUpdateDependenciesStrategy: handleUpdateDependenciesStrategy,
  };
};
