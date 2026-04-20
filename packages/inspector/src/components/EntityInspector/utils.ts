export const toNumber = (value: string, def: number = 0) => {
  const num = Number(value);
  return isNaN(num) ? def : num;
};

export const toString = (value: unknown, def: number | string = 0) => (value ?? def).toString();

/** Formats a float to at most 5 decimal places, truncating (not rounding) and stripping trailing zeros. */
export const formatFloat = (value: number): string => {
  const truncated = Math.trunc(value * 100000) / 100000;
  return truncated.toString();
};
