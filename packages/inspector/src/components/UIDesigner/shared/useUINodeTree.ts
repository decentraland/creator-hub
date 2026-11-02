import { useEffect } from 'react';

import { useAppSelector } from '../../../redux/hooks';
import { getPlatform } from '../../../redux/ui-designer';
import { bootstrapCodeMode, useCodeState } from '../code/store';
import type { CodeUINode } from '../code/types';

/** Code-mode UI tree parsed from the .tsx buffer (the single source of truth). */
export function useUINodeTree(): CodeUINode | null {
  const codeState = useCodeState();
  const platform = useAppSelector(getPlatform);

  useEffect(() => {
    bootstrapCodeMode();
  }, []);

  const root = codeState.parsed?.root ?? null;
  if (root?.platformVariant) {
    return root.children.find(c => c.platform === platform) ?? root.children[0] ?? null;
  }
  return root;
}
