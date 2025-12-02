import { toCamelCase } from './utils';
import type { SignedFetchRequest } from '~system/SignedFetch';
import { signedFetch } from '~system/SignedFetch';
import type { PBRealmInfo } from '~system/Runtime';
import { getRealm as getRealmRuntime } from '~system/Runtime';

type Opts = {
  toCamelCase?: boolean;
};
export async function wrapSignedFetch<T = unknown>(
  signedFetchBody: SignedFetchRequest,
  opts: Opts = {},
): Promise<Result<T, string>> {
  // TODO: uncomment this
  const realm = await getRealm();

  if (realm?.isPreview) {
    return ['Try again in Genesis/World. LocalPreview not supported.', null];
  }

  const [error, value] = await tryCatch(signedFetch(signedFetchBody));

  if (!value?.ok || error) {
    console.log(`Error in ${signedFetchBody.url} endpoint`, JSON.stringify({ error, value }));
    return [error?.message ?? value?.body ?? 'There was an error', null];
  }
  const [_, body] = await tryCatch<T>(JSON.parse(value.body || '{}'));

  return [null, opts.toCamelCase ? toCamelCase(body ?? {}) : (body ?? {})] as [null, T];
}

// Types for the result object with discriminated union
export type Success<T> = [null, T];

export type Failure<E> = [E, null];

export type Result<T, E = Error> = Success<T> | Failure<E>;

// Main wrapper function
export async function tryCatch<T, E = Error>(promise: Promise<T>): Promise<Result<T, E>> {
  try {
    const data = await promise;
    return [null, data];
  } catch (error) {
    return [error as E, null];
  }
}

let realmCache: PBRealmInfo | undefined;

export async function getRealm() {
  if (realmCache) return realmCache;
  return (realmCache = (await getRealmRuntime({})).realmInfo);
}

getRealm();

export function isPreview() {
  return !!realmCache?.isPreview;
}

export function getDomain() {
  if (!realmCache || realmCache.networkId === 1) return 'org';
  return 'zone';
}
