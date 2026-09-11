import { useEffect, type MutableRefObject } from 'react';

import { editor } from '#preload';

import type { RPCInfo } from '/@/modules/rpc';

/**
 * Hand the Bevy realm bundler's build events to the inspector, which decides whether a
 * rebuild came from a code edit (hot-reload the engine scene) or from its own autosave
 * (nothing to do). Only while the Bevy renderer is active: pass `projectPath` undefined
 * otherwise.
 */
export function useBevyBuildForwarding(
  iframeRef: MutableRefObject<RPCInfo | undefined>,
  projectPath: string | undefined,
) {
  useEffect(() => {
    if (!projectPath) return;
    return editor.onBevyRealmBuildEvent(({ path, ...event }) => {
      if (path !== projectPath) return;
      const scene = iframeRef.current?.scene;
      if (!scene) return;
      // The inspector may still be booting (no scene RPC server yet) — a lost event
      // is harmless, the next rebuild cycle reports again.
      void scene.notifySceneBuild(event).catch(() => {});
    });
  }, [iframeRef, projectPath]);
}
