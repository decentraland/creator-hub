import { Quaternion, Vector3 } from '@babylonjs/core';
import mitt from 'mitt';

const getSnapManager = () => {
  // defaults
  let positionSnap = 0.25;
  let rotationSnap = 15 * (Math.PI / 180);
  let scaleSnap = 0.1;
  let enabled = true;

  // events
  const events = mitt<{ change: void }>();

  function getPositionSnap() {
    return positionSnap;
  }

  // getters/setters
  function setPositionSnap(value: number) {
    positionSnap = value;
    events.emit('change');
  }

  function getRotationSnap() {
    return rotationSnap;
  }

  function setRotationSnap(value: number) {
    rotationSnap = value;
    events.emit('change');
  }

  function getScaleSnap() {
    return scaleSnap;
  }

  function setScaleSnap(value: number) {
    scaleSnap = value;
    events.emit('change');
  }

  function isEnabled() {
    return enabled;
  }

  function setEnabled(value: boolean) {
    enabled = value;
    events.emit('change');
  }

  function toggle() {
    const value = !isEnabled();
    setEnabled(value);
    return value;
  }

  // handlers
  function onChange(
    cb: (values: {
      positionSnap: number;
      rotationSnap: number;
      scaleSnap: number;
      enabled: boolean;
    }) => void,
  ) {
    const handler = () => cb({ positionSnap, rotationSnap, scaleSnap, enabled });
    events.on('change', handler);
    return () => events.off('change', handler);
  }

  return {
    getPositionSnap,
    setPositionSnap,
    getRotationSnap,
    setRotationSnap,
    getScaleSnap,
    setScaleSnap,
    isEnabled,
    setEnabled,
    onChange,
    toggle,
  };
};

export const snapManager = getSnapManager();

export function snapValue(value: number, snap: number) {
  return snap > 0 ? Math.round(value / snap) * snap : value;
}

export function snapVector(vector: Vector3, snap: number) {
  return new Vector3(
    snapValue(vector.x, snap),
    snapValue(vector.y, snap),
    snapValue(vector.z, snap),
  );
}

export function snapQuaternion(quaternion: Quaternion, snap: number) {
  const angles = snapVector(quaternion.toEulerAngles(), snap);
  return Quaternion.FromEulerVector(angles);
}

export function snapPosition(position: Vector3) {
  return snapManager.isEnabled() ? snapVector(position, snapManager.getPositionSnap()) : position;
}

/**
 * Renderer-agnostic position snap: operates on plain `{x, y, z}` data (not a
 * Babylon `Vector3`), so callers across the renderer boundary (e.g. asset-drop
 * placement) don't need the Babylon module loaded. Mirrors {@link snapPosition}.
 */
export function snapPositionValue(position: { x: number; y: number; z: number }) {
  if (!snapManager.isEnabled()) return position;
  const snap = snapManager.getPositionSnap();
  return {
    x: snapValue(position.x, snap),
    y: snapValue(position.y, snap),
    z: snapValue(position.z, snap),
  };
}

export function snapScale(scale: Vector3) {
  return snapManager.isEnabled() ? snapVector(scale, snapManager.getScaleSnap()) : scale;
}

/**
 * Renderer-agnostic scale snap: plain `{x, y, z}` data, for callers across the
 * renderer boundary (e.g. the reverse-channel gizmo merge). Mirrors
 * {@link snapScale}.
 */
export function snapScaleValue(scale: { x: number; y: number; z: number }) {
  if (!snapManager.isEnabled()) return scale;
  const snap = snapManager.getScaleSnap();
  return { x: snapValue(scale.x, snap), y: snapValue(scale.y, snap), z: snapValue(scale.z, snap) };
}

/**
 * Renderer-agnostic rotation snap: plain `{x, y, z, w}` quaternion data, for
 * callers across the renderer boundary (e.g. the reverse-channel gizmo merge).
 * Snaps the euler decomposition to the rotation step, like {@link snapRotation}.
 */
export function snapRotationValue(rotation: { x: number; y: number; z: number; w: number }) {
  if (!snapManager.isEnabled()) return rotation;
  const snapped = snapQuaternion(
    new Quaternion(rotation.x, rotation.y, rotation.z, rotation.w),
    snapManager.getRotationSnap(),
  );
  return { x: snapped.x, y: snapped.y, z: snapped.z, w: snapped.w };
}

export function snapRotation(rotation: Quaternion) {
  return snapManager.isEnabled()
    ? snapQuaternion(rotation, snapManager.getRotationSnap())
    : rotation;
}
