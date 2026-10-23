import { useCallback, useEffect, useState } from 'react';
import { useSdk } from '../sdk/useSdk';
import type { RendererGizmos } from '../../lib/renderer/types';

const readAlignment = (gizmos: RendererGizmos | undefined) => ({
  isGizmoWorldAligned: gizmos?.isWorldAligned() ?? false,
  isGizmoWorldAlignmentDisabled: gizmos?.isWorldAlignmentDisabled() ?? false,
});

/** Mirrors the renderer's gizmo world-alignment setting; the renderer is the source of truth. */
export const useGizmoAlignment = () => {
  const gizmos = useSdk()?.renderer.gizmos;
  const [alignment, setAlignment] = useState(() => readAlignment(gizmos));

  useEffect(() => {
    if (!gizmos) return;
    const sync = () => setAlignment(readAlignment(gizmos));
    sync();
    return gizmos.onChange(sync);
  }, [gizmos]);

  const setGizmoWorldAligned = useCallback(
    (value: boolean) => {
      if (!gizmos || gizmos.isWorldAlignmentDisabled()) return;
      gizmos.setWorldAligned(value);
      setAlignment(current => ({ ...current, isGizmoWorldAligned: value }));
    },
    [gizmos],
  );

  return { ...alignment, setGizmoWorldAligned };
};
