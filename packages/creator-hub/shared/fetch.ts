import { ErrorBase } from './types/error';

export type FetchErrorName = 'NO_INTERNET_CONNECTION' | 'REQUEST_TIMEOUT';

export class FetchError extends ErrorBase<FetchErrorName> {
  constructor(
    public name: FetchErrorName,
    public error?: Error,
  ) {
    super(name, error?.message || `Fetch error: ${name}`);
  }
}

export const isFetchError = (
  error: unknown,
  type: FetchErrorName | FetchErrorName[] | '*',
): error is FetchError =>
  error instanceof FetchError &&
  (Array.isArray(type) ? type.includes(error.name) : type === '*' || error.name === type);

/** Check if there's an internet connection */
function isOnline(): boolean {
  try {
    // navigator object is partially implemented in nodejs runtime/electron,
    // in that case navigator.onLine may be undefined, so we fallback to true.
    return navigator.onLine ?? true;
  } catch (error) {
    return true; // On Nodejs process navigator is not defined, just rely on timeout...
  }
}

/**
 * Fetch with timeout and offline handling
 * @param input - Request input
 * @param init - Request init options
 * @param timeoutMs - Timeout in milliseconds (default: 5000)
 */
export async function fetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs: number = 5000,
): Promise<Response> {
  if (!isOnline()) {
    throw new FetchError('NO_INTERNET_CONNECTION');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await globalThis.fetch(input, {
      ...init,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new FetchError('REQUEST_TIMEOUT', error);
    }
    throw error;
  }
}
