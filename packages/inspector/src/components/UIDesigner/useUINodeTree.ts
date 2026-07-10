import { useEffect } from 'react';

import type { UINode } from './tree-model';
import { bootstrapCodeMode, useCodeState } from './code/store';

// Code-mode only: the UI tree comes from the parsed .tsx buffer (the single
// source of truth), not from live ECS components. Kept as a hook so Canvas /
// NodeTree re-render when the store updates (useCodeState → useSyncExternalStore).
export function useUINodeTree(): UINode | null {
  const codeState = useCodeState();

  // Adopt the src/ui/ file-per-root layout for this scene once (seed a starter
  // root if empty) and start the disk watcher.
  useEffect(() => {
    bootstrapCodeMode();
  }, []);

  return (codeState.parsed?.root as UINode | undefined) ?? null;
}
