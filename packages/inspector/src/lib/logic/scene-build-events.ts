/**
 * Build events from the scene's `sdk-commands start` bundler, relayed by the host
 * (Creator Hub main → renderer → `notify_scene_build`). Each rebuild cycle reports
 * the file that triggered it and then that the bundle landed. The Bevy renderer uses
 * them to hot-reload for a code edit but not for the editor's own autosave — see
 * `renderer/bevy/build-reload-bridge.ts`. Without a host (standalone inspector) no
 * events ever arrive and nothing reloads.
 */
export type SceneBuildEvent = { kind: 'rebuild'; file: string } | { kind: 'bundle-saved' };

type Listener = (event: SceneBuildEvent) => void;

const listeners = new Set<Listener>();

export function publishSceneBuildEvent(event: SceneBuildEvent): void {
  for (const listener of [...listeners]) listener(event);
}

export function onSceneBuildEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
