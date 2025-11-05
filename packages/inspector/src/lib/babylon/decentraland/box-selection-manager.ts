import mitt from 'mitt';

/**
 * Box Selection Manager
 * Manages settings for the box selection feature:
 * - Select Through: When enabled, selects all objects in the box regardless of occlusion
 * - X-Ray: When enabled, shows selected object outlines through other geometry
 */

const getBoxSelectionManager = () => {
  // defaults
  let selectThroughEnabled = true; // Select all objects (including occluded ones)
  let xRayEnabled = false; // X-Ray mode disabled by default

  // events
  const events = mitt<{ change: void }>();

  // Getters
  function isSelectThroughEnabled() {
    return selectThroughEnabled;
  }

  function isXRayEnabled() {
    return xRayEnabled;
  }

  // Setters
  function setSelectThroughEnabled(value: boolean) {
    selectThroughEnabled = value;
    events.emit('change');
  }

  function setXRayEnabled(value: boolean) {
    xRayEnabled = value;
    events.emit('change');
  }

  // Toggles
  function toggleSelectThrough() {
    const value = !isSelectThroughEnabled();
    setSelectThroughEnabled(value);
    return value;
  }

  function toggleXRay() {
    const value = !isXRayEnabled();
    setXRayEnabled(value);
    return value;
  }

  // Event handler
  function onChange(cb: (values: { selectThroughEnabled: boolean; xRayEnabled: boolean }) => void) {
    const handler = () => cb({ selectThroughEnabled, xRayEnabled });
    events.on('change', handler);
    return () => events.off('change', handler);
  }

  return {
    isSelectThroughEnabled,
    setSelectThroughEnabled,
    toggleSelectThrough,
    isXRayEnabled,
    setXRayEnabled,
    toggleXRay,
    onChange,
  };
};

export const boxSelectionManager = getBoxSelectionManager();
