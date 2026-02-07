/**
 * Convert a snake_case object to a camelCase object.
 * @param obj - The object to convert.
 * @returns The converted object.
 * @example fromSnakeToCamel({ snake_case: { nested_key: 'value' } }) // { snakeCase: { nestedKey: 'value' } }
 */
export function fromSnakeToCamel(obj: Record<string, any>): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(item => fromSnakeToCamel(item));

  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [
      key.replace(/_([a-z])/g, (_, char) => char.toUpperCase()),
      fromSnakeToCamel(value),
    ]),
  );
}

/**
 * Convert a camelCase object to a snake_case object.
 * @param obj - The object to convert.
 * @returns The converted object.
 * @example fromCamelToSnake({ camelCase: { nestedKey: 'value' } }) // { snake_case: { nested_key: 'value' } }
 */
export function fromCamelToSnake(obj: Record<string, any>): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(item => fromCamelToSnake(item));

  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [
      key.replace(/([A-Z])/g, (_, char, offset) => (offset > 0 ? '_' : '') + char.toLowerCase()),
      fromCamelToSnake(value),
    ]),
  );
}
