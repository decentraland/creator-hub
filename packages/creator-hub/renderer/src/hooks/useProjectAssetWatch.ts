import { useEffect, type MutableRefObject } from 'react';

import { editor } from '#preload';

import type { RPCInfo } from '/@/modules/rpc';

/**
 * While a project is open in the editor, watch its assets/ folder for files added, changed,
 * or removed from OUTSIDE the app (a drag into Finder/Explorer) and tell the inspector to
 * re-fetch its asset catalog, so the project explorer refreshes on its own instead of
 * needing the manual "Refresh assets" button (#512).
 *
 * Runs under both renderers — the catalog panel exists in each — so `projectPath` is passed
 * whenever a project is open, not gated on the renderer (unlike the Bevy build forwarding).
 */
export function useProjectAssetWatch(
  iframeRef: MutableRefObject<RPCInfo | undefined>,
  projectPath: string | undefined,
) {
  useEffect(() => {
    if (!projectPath) return;
    void editor.startProjectWatcher(projectPath).catch(() => {});
    const unsubscribe = editor.onProjectAssetsChanged(({ path }) => {
      if (path !== projectPath) return;
      // The inspector may still be booting (no scene RPC server yet) — a lost nudge is
      // harmless, the next change reports again.
      void iframeRef.current?.scene.notifyAssetsChanged().catch(() => {});
    });
    return () => {
      unsubscribe();
      void editor.stopProjectWatcher(projectPath).catch(() => {});
    };
  }, [iframeRef, projectPath]);
}
