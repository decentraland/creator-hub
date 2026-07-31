import { useCallback, useEffect, useRef, useState } from 'react';
import { useSdk } from '../sdk/useSdk';
import type { RendererGizmos } from '../../lib/renderer/types';

export const useGizmoAlignment = () => {
  const gizmosRef = useRef<RendererGizmos | null>(null);
  const [isGizmoWorldAligned, setGizmoWorldAligned] = useState(false);
  const [isGizmoWorldAlignmentDisabled, setGizmoWorldAlignmentDisabled] = useState(false);

  // update world gizmo alignment only if is not disabled
  const safeSetGizmoWorldAligned = useCallback(
    (value: boolean) => {
      if (!isGizmoWorldAlignmentDisabled) {
        setGizmoWorldAligned(value);
      }
    },
    [isGizmoWorldAligned],
  );

  // sync from renderer to hook state
  const updateState = useCallback(() => {
    if (gizmosRef.current) {
      const gizmos = gizmosRef.current;
      if (isGizmoWorldAligned !== gizmos.isWorldAligned()) {
        setGizmoWorldAligned(gizmos.isWorldAligned());
      }
      if (isGizmoWorldAlignmentDisabled !== gizmos.isWorldAlignmentDisabled()) {
        setGizmoWorldAlignmentDisabled(gizmos.isWorldAlignmentDisabled());
      }
    }
  }, [isGizmoWorldAligned, isGizmoWorldAlignmentDisabled]);

  // sync from hook state to renderer
  const updateRenderer = useCallback(() => {
    if (gizmosRef.current) {
      const gizmos = gizmosRef.current;
      if (gizmos.isWorldAligned() !== isGizmoWorldAligned) {
        gizmos.setWorldAligned(isGizmoWorldAligned);
      }
    }
  }, [isGizmoWorldAligned]);

  // bind changes on renderer to update hook state
  useSdk(
    ({ renderer }) => {
      if (!gizmosRef.current) {
        gizmosRef.current = renderer.gizmos;
        updateState();
      }
      return renderer.gizmos.onChange(updateState);
    },
    [updateState],
  );

  // bind changes in hook state to update renderer
  useEffect(() => {
    updateRenderer();
  }, [updateRenderer]);

  return {
    isGizmoWorldAligned,
    isGizmoWorldAlignmentDisabled,
    setGizmoWorldAligned: safeSetGizmoWorldAligned,
  };
};
