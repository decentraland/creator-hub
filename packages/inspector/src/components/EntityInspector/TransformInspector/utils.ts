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

export function toTransform(currentValue?: TransformType, config?: TransformConfig) {
  // Track the original scale before any incomplete input
  let originalScale: Vector3Type | undefined = currentValue?.scale;

  return (inputs: TransformInput): TransformType => {
    const quaternion = Quaternion.RotationYawPitchRoll(
      (Number(inputs.rotation.y) * Math.PI) / 180,
      (Number(inputs.rotation.x) * Math.PI) / 180,
      (Number(inputs.rotation.z) * Math.PI) / 180,
    );
    const scale = mapToNumber(inputs.scale);

    // Check if we're detecting incomplete input
    let hasIncompleteInput = false;
    if (currentValue) {
      const scaleInputStrings = inputs.scale;
      hasIncompleteInput = Object.keys(scaleInputStrings).some(key => {
        const k = key as keyof typeof scaleInputStrings;
        const inputStr = scaleInputStrings[k];
        const numValue = scale[k];
        const oldNumValue = currentValue!.scale[k];
        return numValue === 0 && Math.abs(oldNumValue) > 0.01 && inputStr === '0';
      });
    }

    // Calculate scale result
    const scaleResult = currentValue
      ? getScale(
          currentValue.scale,
          scale,
          inputs.scale,
          originalScale,
          !!config?.porportionalScaling,
        )
      : scale;

    // Update originalScale if input is complete (not incomplete)
    // This way originalScale always points to the last complete value
    if (!hasIncompleteInput) {
      originalScale = scaleResult;
    }

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

export const getScale = (
  oldValue: Vector3Type,
  value: Vector3Type,
  inputStrings: { x: string; y: string; z: string },
  originalValue: Vector3Type | undefined,
  maintainPorportion: boolean,
) => {
  if (!maintainPorportion) return value;

  let changedFactor: keyof Vector3Type | undefined = undefined;

  for (const factor in value) {
    const key = factor as keyof Vector3Type;
    if (oldValue[key] !== value[key]) {
      changedFactor = key;
      break;
    }
  }

  if (changedFactor === undefined) return value;

  // Check if the input looks incomplete (e.g., "0" when typing "0.5")
  // If the changed value is 0 and old value was non-zero, and the input string
  // is exactly "0" (not "0.0" or "0.00"), it might be incomplete
  const changedValue = value[changedFactor];
  const oldChangedValue = oldValue[changedFactor];
  const inputString = inputStrings[changedFactor];

  const isIncompleteInput =
    changedValue === 0 && Math.abs(oldChangedValue) > 0.01 && inputString === '0';

  const vector = { ...value };

  for (const factor in vector) {
    const key = factor as keyof Vector3Type;
    if (changedFactor === key) continue;

    if (isIncompleteInput) {
      // For incomplete input, preserve old values for unchanged fields
      // This prevents intermediate "0" from corrupting the values
      vector[key] = oldValue[key];
    } else if (oldValue[changedFactor] === 0 && value[changedFactor] !== 0) {
      // Recovering from incomplete input (0 -> non-zero)
      // Use originalValue (the value before incomplete input) as the base for calculations
      if (originalValue && originalValue[changedFactor] !== 0) {
        const ratio = value[changedFactor] / originalValue[changedFactor];
        vector[key] = originalValue[key] * ratio;
      } else {
        // Don't have originalValue, preserve old values
        vector[key] = oldValue[key];
      }
    } else {
      // Normal proportional scaling - use oldValue[key] as the base
      const div = oldValue[changedFactor] || 1;
      if (div === 0) {
        // Can't calculate ratio from 0, preserve old values
        vector[key] = oldValue[key];
      } else {
        const ratio = value[changedFactor] / div;
        vector[key] = oldValue[key] * ratio;
      }
    }
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
