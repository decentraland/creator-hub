import equal from 'fast-deep-equal';

/**
 * Deep equality check with tolerance for floating-point numbers
 * Wrapper around fast-deep-equal that provides the same interface as jest-matcher-deep-close-to/lib/recursiveCheck
 */

export function deepEqualWithTolerance(actual: any, expected: any, tolerance: number = 0): boolean {
  // If tolerance is 0, use fast-deep-equal directly
  if (tolerance === 0) {
    return equal(actual, expected);
  }

  // For tolerance > 0, we need custom comparison for numbers
  return deepEqualWithToleranceRecursive(actual, expected, tolerance);
}

function deepEqualWithToleranceRecursive(actual: any, expected: any, tolerance: number): boolean {
  // Handle null/undefined cases
  if (actual === expected) return true;
  if (actual == null || expected == null) return actual === expected;

  // Handle primitive types
  if (typeof actual !== 'object' || typeof expected !== 'object') {
    // Only apply tolerance for floating-point numbers
    if (
      typeof actual === 'number' &&
      typeof expected === 'number' &&
      (!Number.isInteger(actual) || !Number.isInteger(expected))
    ) {
      if (isNaN(actual) && isNaN(expected)) return true; // consider NaN equal to NaN
      return Math.abs(actual - expected) < Math.pow(10, -tolerance);
    }

    return actual === expected;
  }

  // Handle arrays
  if (Array.isArray(actual) !== Array.isArray(expected)) return false;
  if (Array.isArray(actual)) {
    if (actual.length !== expected.length) return false;
    for (let i = 0; i < actual.length; i++) {
      if (!deepEqualWithToleranceRecursive(actual[i], expected[i], tolerance)) {
        return false;
      }
    }
    return true;
  }

  // Handle objects
  const actualKeys = Object.keys(actual);
  const expectedKeys = Object.keys(expected);

  if (actualKeys.length !== expectedKeys.length) return false;

  for (const key of actualKeys) {
    if (!expectedKeys.includes(key)) return false;
    if (!deepEqualWithToleranceRecursive(actual[key], expected[key], tolerance)) {
      return false;
    }
  }

  return true;
}

/**
 * Alias for backward compatibility with existing code
 * This function returns true if the objects are NOT equal (opposite of deepEqualWithTolerance)
 * to maintain the same behavior as the original recursiveCheck
 */
export function recursiveCheck(actual: any, expected: any, tolerance: number = 0): boolean {
  return !deepEqualWithTolerance(actual, expected, tolerance);
}
