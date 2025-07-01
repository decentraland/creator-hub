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
      if (timeout) clearTimeout(timeout);
      if (waitFor) clearTimeout(waitFor);
    },
  ];
};

export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const CLIENT_NOT_INSTALLED_ERROR = 'Decentraland Desktop Client failed with';

interface DebounceState {
  timer: NodeJS.Timeout | null;
  lastCall: number;
  lastResult: any;
  pendingPromises: Array<{
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }>;
}

interface DebounceOptions {
  leading?: boolean;
  trailing?: boolean;
  maxWait?: number;
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  options: DebounceOptions = {},
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  const state: DebounceState = {
    timer: null,
    lastCall: 0,
    lastResult: undefined,
    pendingPromises: [],
  };

  const { leading = false, trailing = true, maxWait } = options;

  return (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const now = Date.now();
    const isFirstCall = state.lastCall === 0;
    const timeSinceLastCall = now - state.lastCall;
    state.lastCall = now;

    return new Promise((resolve, reject) => {
      state.pendingPromises.push({ resolve, reject });

      const invokeFunction = () => {
        try {
          state.lastResult = func(...args);
          state.pendingPromises.forEach(({ resolve }) => resolve(state.lastResult));
        } catch (error) {
          state.pendingPromises.forEach(({ reject }) => reject(error));
        }
        state.pendingPromises = [];
      };

      const shouldInvokeLeading = leading && (isFirstCall || timeSinceLastCall >= wait);
      const hasReachedMaxWait = maxWait && timeSinceLastCall >= maxWait;

      if (state.timer) {
        clearTimeout(state.timer);
        state.timer = null;
      }

      if (shouldInvokeLeading || hasReachedMaxWait) {
        invokeFunction();
      } else if (trailing) {
        state.timer = setTimeout(() => {
          invokeFunction();
          state.timer = null;
        }, wait);
      }
    });
  };
}

export function debounceByKey<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  keySelector: (...args: Parameters<T>) => string,
  options: DebounceOptions = {},
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  const debouncedFunctions = new Map<string, ReturnType<typeof debounce>>();

  return (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const key = keySelector(...args);

    if (!debouncedFunctions.has(key)) {
      debouncedFunctions.set(key, debounce(func, wait, options));
    }

    return debouncedFunctions.get(key)!(...args);
  };
}
