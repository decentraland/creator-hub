import { useEffect, type MutableRefObject } from 'react';

import { editor } from '#preload';

import type { RPCInfo } from '/@/modules/rpc';

const normalizeSlashes = (path: string) => path.replace(/\\/g, '/').replace(/\/+$/, '');

/**
 * The bundler prints trigger files as absolute paths; the inspector reasons about
 * scene-relative ones (`assets/scene/main.composite`, `src/ui/root.tsx`) and matches
 * them exactly. Strip the project root here, where it is known. Case-insensitive on
 * the prefix: a Windows drive letter can differ in case between the two sources.
 */
export function toSceneRelative(file: string, projectPath: string): string {
  const normalized = normalizeSlashes(file);
  const root = `${normalizeSlashes(projectPath)}/`;
  return normalized.toLowerCase().startsWith(root.toLowerCase())
    ? normalized.slice(root.length)
    : normalized;
}

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
      const relative =
        event.kind === 'rebuild'
          ? { kind: event.kind, file: toSceneRelative(event.file, projectPath) }
          : event;
      // The inspector may still be booting (no scene RPC server yet) — a lost event
      // is harmless, the next rebuild cycle reports again.
      void scene.notifySceneBuild(relative).catch(() => {});
    });
  }, [iframeRef, projectPath]);
}
