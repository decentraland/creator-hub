/**
 * Formats an object into a query string, filtering out undefined and null values.
 * @param params - The object to format.
 * @returns The formatted query string.
 * @example formatQueryParams({ search: 'query', page: 1, filter: undefined }) // 'search=query&page=1'
 */
export const formatQueryParams = (params: Record<string, any>): string => {
  return new URLSearchParams(
    Object.entries(params || {})
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, value?.toString()]),
  ).toString();
};

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
