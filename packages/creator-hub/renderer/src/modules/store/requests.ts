/**
 * Settles one request in `inFlight`.
 * @returns false when it is stale
 */
export function settleRequest(inFlight: string[], requestId: string) {
  const index = inFlight.indexOf(requestId);
  if (index >= 0) inFlight.splice(index, 1);
  return index >= 0;
}

/**
 * Settles a request and every older one in `inFlight` (oldest first), so none can overwrite it.
 * @returns false when it is stale
 */
export function settleRequestAndOlder(inFlight: string[], requestId: string) {
  const index = inFlight.indexOf(requestId);
  if (index >= 0) inFlight.splice(0, index + 1);
  return index >= 0;
}
