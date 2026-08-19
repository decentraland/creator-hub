import { useEffect } from 'react';

import { useAppSelector } from '../../../redux/hooks';
import { getPlatform } from '../../../redux/ui-designer';
import { bootstrapCodeMode, useCodeState } from '../code/store';
import type { CodeUINode } from '../code/types';

// Code-mode only: the UI tree comes from the parsed .tsx buffer (the single
// source of truth), not from live ECS components. Kept as a hook so Canvas /
// NodeTree re-render when the store updates (useCodeState → useSyncExternalStore).
// Typed as CodeUINode (not the narrower UINode it used to widen away): the
// code-mode extras — `span`, `opaque`, `interaction` — are exactly what the
// canvas and tree need to render a node faithfully.
export function useUINodeTree(): CodeUINode | null {
  const codeState = useCodeState();
  const platform = useAppSelector(getPlatform);

  // Adopt the src/ui/ file-per-root layout for this scene once (seed a starter
  // root if empty) and start the disk watcher.
  useEffect(() => {
    bootstrapCodeMode();
  }, []);

  const root = codeState.parsed?.root ?? null;
  // Device variants belong to the GUI, not to a node: the root's two branches are
  // alternative WHOLE trees, so present the active device's branch AS the root.
  // Canvas and NodeTree then render a variant GUI exactly like a plain one and the
  // device toggle swaps the entire tree — no variant/branch rows to navigate.
  // Falls back to the first branch so a hand-authored one-sided conditional still
  // renders something.
  if (root?.platformVariant) {
    return root.children.find(c => c.platform === platform) ?? root.children[0] ?? null;
  }
  return root;
}
