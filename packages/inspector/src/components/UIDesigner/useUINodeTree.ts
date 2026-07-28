import { useEffect } from 'react';

import { bootstrapCodeMode, useCodeState } from './code/store';
import type { CodeUINode } from './code/types';

// Code-mode only: the UI tree comes from the parsed .tsx buffer (the single
// source of truth), not from live ECS components. Kept as a hook so Canvas /
// NodeTree re-render when the store updates (useCodeState → useSyncExternalStore).
// Typed as CodeUINode (not the narrower UINode it used to widen away): the
// code-mode extras — `span`, `opaque`, `interaction` — are exactly what the
// canvas and tree need to render a node faithfully.
export function useUINodeTree(): CodeUINode | null {
  const codeState = useCodeState();

  // Adopt the src/ui/ file-per-root layout for this scene once (seed a starter
  // root if empty) and start the disk watcher.
  useEffect(() => {
    bootstrapCodeMode();
  }, []);

  return codeState.parsed?.root ?? null;
}
