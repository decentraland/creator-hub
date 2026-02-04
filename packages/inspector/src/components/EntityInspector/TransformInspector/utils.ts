import { Quaternion } from '@babylonjs/core';
import type { TransformType, Vector3Type } from '@dcl/ecs';

import type { TransformConfig } from '../../../lib/sdk/components/TransformConfig';
import type { TransformInput } from './types';

export function fromTransform(value: TransformType): TransformInput {
  const angles = new Quaternion(
    value.rotation.x,
    value.rotation.y,
    value.rotation.z,
    value.rotation.w,
  ).toEulerAngles();
  return {
    position: {
      x: value.position.x.toFixed(2),
      y: value.position.y.toFixed(2),
      z: value.position.z.toFixed(2),
    },
    scale: {
      x: value.scale.x.toFixed(2),
      y: value.scale.y.toFixed(2),
      z: value.scale.z.toFixed(2),
    },
    rotation: {
      x: formatAngle((angles.x * 180) / Math.PI),
      y: formatAngle((angles.y * 180) / Math.PI),
      z: formatAngle((angles.z * 180) / Math.PI),
    },
  };
}

function formatAngle(angle: number) {
  const sanitizedAngle = angle < 0 ? 360 + angle : angle;
  const value = sanitizedAngle.toFixed(2);
  return value === '360.00' ? '0.00' : value;
}

/**
 * Creates a converter function that transforms TransformInput to TransformType.
 * Handles proportional scaling when enabled in config.
 */
export function toTransform(currentValue?: TransformType, config?: TransformConfig) {
  return (inputs: TransformInput): TransformType => {
    const quaternion = Quaternion.RotationYawPitchRoll(
      (Number(inputs.rotation.y) * Math.PI) / 180,
      (Number(inputs.rotation.x) * Math.PI) / 180,
      (Number(inputs.rotation.z) * Math.PI) / 180,
    );
    const scale = mapToNumber(inputs.scale);

    const scaleResult = currentValue
      ? getScale(currentValue.scale, scale, !!config?.porportionalScaling)
      : scale;

    const result: TransformType = {
      position: mapToNumber(inputs.position),
      scale: scaleResult,
      rotation: {
        x: quaternion.x,
        y: quaternion.y,
        z: quaternion.z,
        w: quaternion.w,
      },
    };

    return normalizeTransform(result);
  };
}

export const mapToNumber = <T extends Record<string, unknown>>(
  input: T,
): { [key in keyof T]: number } => {
  const res: any = {};
  for (const key in input) {
    const value = Number(input[key]);
    res[key] = isNaN(value) ? 0 : value;
  }
  return res;
};

/**
 * Calculates proportionally scaled values when one axis changes.
 *
 * When proportional scaling is enabled and one axis changes, the other axes
 * are scaled by the same ratio to maintain proportions.
 *
 * Formula: newValue[otherAxis] = oldValue[otherAxis] * (newValue[changedAxis] / oldValue[changedAxis])
 *
 * Special handling:
 * - If the changed value is 0 and would zero out all axes, only the changed axis
 *   is set to 0 while others are preserved. This prevents accidental data loss
 *   when typing decimal values like "0.5" (where "0" is an intermediate state).
 * - If the old changed value is 0, we can't calculate a ratio, so values are preserved.
 *
 * @param oldValue - The previous scale values
 * @param value - The new scale values (with one axis changed by the user)
 * @param maintainProportion - Whether proportional scaling is enabled
 * @returns The calculated scale values
 */
export const getScale = (
  oldValue: Vector3Type,
  value: Vector3Type,
  maintainProportion: boolean,
): Vector3Type => {
  if (!maintainProportion) return value;

  let changedFactor: keyof Vector3Type | undefined = undefined;
  for (const factor in value) {
    const key = factor as keyof Vector3Type;
    if (oldValue[key] !== value[key]) {
      changedFactor = key;
      break;
    }
  }

  if (changedFactor === undefined) return value;

  const oldChangedValue = oldValue[changedFactor];
  const newChangedValue = value[changedFactor];

  // If the new value is 0, don't apply proportional scaling to other axes.
  // This prevents zeroing out all values when typing decimals like "0.5"
  // where "0" is just an intermediate typing state.
  // Users who want all zeros can manually set each axis to 0.
  if (newChangedValue === 0) {
    return value;
  }

  // If oldChangedValue is 0, we can't calculate a ratio directly.
  // But if the other axes have a consistent value, use that as reference.
  // This handles the case where user typed "0" then "0.25" - we want 0.25 to scale all axes.
  if (oldChangedValue === 0) {
    // Find a non-zero reference value from other axes
    const otherKeys = (['x', 'y', 'z'] as const).filter(k => k !== changedFactor);
    const referenceKey = otherKeys.find(k => oldValue[k] !== 0);

    if (referenceKey) {
      // Use the reference axis to calculate the ratio
      const ratio = newChangedValue / oldValue[referenceKey];
      const vector = { ...value };
      for (const key of otherKeys) {
        vector[key] = oldValue[key] * ratio;
      }
      return vector;
    }
    // All axes are 0, can't calculate ratio
    return value;
  }

  const ratio = newChangedValue / oldChangedValue;
  const vector = { ...value };

  for (const factor in vector) {
    const key = factor as keyof Vector3Type;
    if (changedFactor === key) continue;

    // apply ratio to unchanged axes using their OLD values as the base
    // Formula: newY = oldY * ratio
    vector[key] = oldValue[key] * ratio;
  }

  return vector;
};

export function fromTransformConfig(value: TransformConfig) {
  return {
    porportionalScaling: !!value.porportionalScaling,
  };
}

/**
 * Normalizes a TransformType to ensure consistent precision
 * This helps with equality comparisons by rounding values to 2 decimal places
 */
export function normalizeTransform(transform: TransformType): TransformType {
  const normalizeVector3 = (v: Vector3Type): Vector3Type => ({
    x: Math.round(v.x * 100) / 100,
    y: Math.round(v.y * 100) / 100,
    z: Math.round(v.z * 100) / 100,
  });

  const normalizeQuaternion = (q: { x: number; y: number; z: number; w: number }) => ({
    x: Math.round(q.x * 10000) / 10000,
    y: Math.round(q.y * 10000) / 10000,
    z: Math.round(q.z * 10000) / 10000,
    w: Math.round(q.w * 10000) / 10000,
  });

  return {
    position: normalizeVector3(transform.position),
    scale: normalizeVector3(transform.scale),
    rotation: normalizeQuaternion(transform.rotation),
  };
}
