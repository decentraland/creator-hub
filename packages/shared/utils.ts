export type Tail<T extends any[]> = T extends [any, ...infer Rest] ? Rest : never;

export function isUrl(url: string) {
  try {
    new URL(url);
    return true;
  } catch (_error) {
    return false;
  }
}

export const throttle = <T, K extends any[]>(
  fn: (...args: K) => T,
  delay: number,
  waitFor?: number,
): [(...args: K) => T | undefined, () => void] => {
  let wait = !!waitFor;
  let timeout: number | undefined;
  let cancelled = false;
  waitFor = waitFor
    ? window.setTimeout(() => {
        wait = false;
      }, waitFor)
    : undefined;

  return [
    (...args: K) => {
      if (cancelled || wait) return undefined;

      const val = fn(...args);
      wait = true;
      timeout = window.setTimeout(() => {
        wait = false;
      }, delay);

      return val;
    },
    () => {
      cancelled = true;
      clearTimeout(timeout);
      clearTimeout(waitFor);
    },
  ];
};

export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
