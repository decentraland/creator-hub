import { useEffect } from 'react';

import { useAppSelector } from '../redux/hooks';
import { getHiddenPanels, getSceneRunIntent } from '../redux/ui';
import { PanelName } from '../redux/ui/types';
import { useSdk } from './sdk/useSdk';

/** Freezes the Bevy scene on entering 2D and resumes it on returning to 3D per `sceneRunIntent`. */
export function useSyncSceneRunWithMode(): void {
  const hiddenPanels = useAppSelector(getHiddenPanels);
  const isUIDesigner = !hiddenPanels[PanelName.UI_DESIGNER];
  const runIntent = useAppSelector(getSceneRunIntent);
  const sdk = useSdk();

  useEffect(() => {
    const sceneRun = sdk?.renderer.sceneRun;
    if (!sceneRun) return;
    if (isUIDesigner) {
      if (sceneRun.isRunning()) sceneRun.setRunning(false);
    } else if (runIntent && !sceneRun.isRunning()) {
      sceneRun.setRunning(true);
    }
  }, [isUIDesigner, runIntent, sdk]);
}
