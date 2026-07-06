export type Tail<T extends any[]> = T extends [any, ...infer Rest] ? Rest : never;

export function isUrl(url: string) {
  try {
    new URL(url);
    return true;
  } catch (_error) {
    return false;
  }
}

// Windows reserved device names (case-insensitive), with or without an extension.
const RESERVED_WINDOWS_NAMES =
  /^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])(\..*)?$/i;

// Characters that are illegal in file/folder names on at least one of the major OSes
// (Windows: < > : " / \ | ? * and control chars; POSIX: / and the null byte).
// eslint-disable-next-line no-control-regex
const ILLEGAL_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1F]/;

const MAX_FOLDER_NAME_LENGTH = 255;

/**
 * Returns whether or not the provided name is a valid, cross-platform-safe file/folder name.
 * Rejects empty/whitespace-only names, names containing illegal filesystem characters, reserved
 * Windows device names, and names that are too long.
 */
export function isValidFolderName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  if (trimmed === '.' || trimmed === '..') return false;
  if (trimmed.length > MAX_FOLDER_NAME_LENGTH) return false;
  if (ILLEGAL_FILENAME_CHARS.test(trimmed)) return false;
  if (RESERVED_WINDOWS_NAMES.test(trimmed)) return false;
  return true;
}

/**
 * Returns the last segment of a file system path (POSIX or Windows), i.e. the file/folder name.
 * Unlike `node:path`'s `basename`, this is safe to use from the renderer, which has no access to
 * Node built-ins.
 */
export function getBaseName(path: string): string {
  const segments = path.split(/[/\\]+/).filter(Boolean);
  return segments[segments.length - 1] ?? '';
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

export function debounce<F extends (...args: any[]) => void>(func: F, delay: number) {
  let timer: ReturnType<typeof setTimeout>;
  return function (...args: Parameters<F>) {
    clearTimeout(timer);
    timer = setTimeout(() => func(...args), delay);
  };
}

export function debounceByKey<F extends (...args: any[]) => void>(
  func: F,
  delay: number,
  keySelector: (...args: Parameters<F>) => string,
): (...args: Parameters<F>) => void {
  const debouncedFunctions = new Map<string, ReturnType<typeof debounce>>();

  return (...args: Parameters<F>): void => {
    const key = keySelector(...args);

    if (!debouncedFunctions.has(key)) {
      debouncedFunctions.set(key, debounce(func, delay));
    }

    debouncedFunctions.get(key)!(...args);
  };
}
