export function isErrorMessage(error?: boolean | string): boolean {
  return !!error && typeof error === 'string';
}

// Constant for mixed/indeterminate values in multi-entity editing
export const MIXED_VALUE = '--';

// Helper function to check if a value is a mixed value
export const isMixedValue = (value: unknown): boolean => value === MIXED_VALUE;
