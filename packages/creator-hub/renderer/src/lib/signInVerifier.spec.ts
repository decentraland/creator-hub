import { describe, expect, it, beforeEach } from 'vitest';
import { createSignInVerifier, deriveSignInRequestId } from './signInVerifier';

// Shared with the auth server, the auth dapp and the Explorer tests.
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const REQUEST_ID = '13d31e96-1a1a-48ec-af16-b10c4c982e08';
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('when deriving a sign in request id from a verifier', () => {
  let verifier: string;

  describe('and the verifier is the shared test vector', () => {
    beforeEach(() => {
      verifier = VERIFIER;
    });

    it('should return the shared request id', async () => {
      expect(await deriveSignInRequestId(verifier)).toBe(REQUEST_ID);
    });
  });

  describe('and the verifier is freshly created', () => {
    beforeEach(() => {
      verifier = createSignInVerifier();
    });

    it('should return a lowercase UUID v4', async () => {
      expect(await deriveSignInRequestId(verifier)).toMatch(UUID_V4);
    });
  });
});

describe('when creating a sign in verifier', () => {
  let verifier: string;
  let otherVerifier: string;

  beforeEach(() => {
    verifier = createSignInVerifier();
    otherVerifier = createSignInVerifier();
  });

  it('should be the unpadded base64url encoding of 32 bytes', () => {
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('should differ on every call', () => {
    expect(verifier).not.toBe(otherVerifier);
  });
});
