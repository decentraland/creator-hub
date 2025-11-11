import { useCallback, useEffect, useRef, useState } from 'react';
import { boxSelectionManager } from '../../lib/babylon/decentraland/box-selection-manager';

/**
 * Hook for managing "Select Through" toggle state
 * When enabled (default), box selection selects all objects regardless of occlusion
 * When disabled, only visible objects are selected
 */
export const useSelectThroughToggle = () => {
  const [isEnabled, setEnabledInternal] = useState<boolean>(
    boxSelectionManager.isSelectThroughEnabled(),
  );
  const skipSyncRef = useRef(false);

  const setEnabled = useCallback((value: boolean, skipSync = false) => {
    skipSyncRef.current = skipSync;
    setEnabledInternal(value);
  }, []);

  const toggle = useCallback(() => setEnabled(!isEnabled), [isEnabled, setEnabled]);

  // send update to manager
  useEffect(() => {
    if (skipSyncRef.current) return;
    boxSelectionManager.setSelectThroughEnabled(isEnabled);
  }, [isEnabled]);

  // receive update from manager
  useEffect(() => {
    const unsubscribe = boxSelectionManager.onChange(() => {
      setEnabled(boxSelectionManager.isSelectThroughEnabled(), true); // skip sync to avoid loop
    });
    return () => unsubscribe();
  }, [setEnabled]);

  return { isEnabled, setEnabled, toggle };
};

/**
 * Hook for managing "X-Ray" toggle state
 * When enabled (default), selected objects show their outline through other geometry
 * When disabled, outlines are only visible when not occluded
 */
export const useXRayToggle = () => {
  const [isEnabled, setEnabledInternal] = useState<boolean>(boxSelectionManager.isXRayEnabled());
  const skipSyncRef = useRef(false);

  const setEnabled = useCallback((value: boolean, skipSync = false) => {
    skipSyncRef.current = skipSync;
    setEnabledInternal(value);
  }, []);

  const toggle = useCallback(() => setEnabled(!isEnabled), [isEnabled, setEnabled]);

  // send update to manager
  useEffect(() => {
    if (skipSyncRef.current) return;
    boxSelectionManager.setXRayEnabled(isEnabled);
  }, [isEnabled]);

  // receive update from manager
  useEffect(() => {
    const unsubscribe = boxSelectionManager.onChange(() => {
      setEnabled(boxSelectionManager.isXRayEnabled(), true); // skip sync to avoid loop
    });
    return () => unsubscribe();
  }, [setEnabled]);

  return { isEnabled, setEnabled, toggle };
};
