import { useEffect } from 'react';

import { useAppSelector } from '../redux/hooks';
import { getHiddenPanels } from '../redux/ui';
import { PanelName } from '../redux/ui/types';
import { useSdk } from './sdk/useSdk';

/**
 * Pause the running scene when the UI Designer opens.
 *
 * The 3D viewport is only CSS-hidden in 2D (App.tsx keeps <Renderer /> mounted so
 * Babylon's GL context survives), so a scene left playing keeps ticking behind
 * `display: none` — and switching back to 3D lands on a live scene whose UI is
 * painted over the whole viewport, above picking. Editing starts from a static
 * scene; Play is the only way back to a running one.
 *
 * Pausing is one-way on purpose: returning to 3D does not resume. `setRunning`
 * fans out to everything that must follow the run state — the agent's scene
 * freeze AND `show_ui <hash> false`, plus the GLTF animation pause.
 *
 * `sceneRun` is Bevy-only (Babylon omits it), and the `isRunning` guard keeps a
 * mode toggle from posting a redundant freeze to the agent.
 */
export function usePauseSceneWhileDesigning(): void {
  const hiddenPanels = useAppSelector(getHiddenPanels);
  const isUIDesigner = !hiddenPanels[PanelName.UI_DESIGNER];
  const sdk = useSdk();

  useEffect(() => {
    if (!isUIDesigner) return;
    const sceneRun = sdk?.renderer.sceneRun;
    if (sceneRun?.isRunning()) sceneRun.setRunning(false);
  }, [isUIDesigner, sdk]);
}
