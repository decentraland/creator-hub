/** Header carrying the verifier when fetching a deep-link sign in identity. */
export const SIGN_IN_VERIFIER_HEADER = 'x-identity-verifier';

const VERIFIER_BYTES = 32;
const UUID_BYTES = 16;

function toBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Creates the secret that proves this app instance started a deep-link sign in:
 * base64url (unpadded) of 32 random bytes. It stays in memory and is only sent
 * to the auth server when fetching the identity, never through the browser.
 */
export function createSignInVerifier(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(VERIFIER_BYTES)));
}

/**
 * Derives the request id the auth dapp is opened with from a verifier: the first
 * 16 bytes of SHA-256(verifier) with the UUID v4 version and variant bits set.
 * The auth server recomputes it from the verifier, and the hash keeps the
 * verifier unrecoverable from the id visible in the browser URL and deep link.
 */
export async function deriveSignInRequestId(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const bytes = new Uint8Array(digest).slice(0, UUID_BYTES);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
