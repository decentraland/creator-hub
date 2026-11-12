import { describe, expect, it } from 'vitest';

import { signedMetadata } from './aiSharingApi';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('when signing a request for the sharing service', () => {
  it('should bind a write body to the signature by its hex SHA-256', async () => {
    const metadata = await signedMetadata('POST', '{"records":[]}');

    // sha256 of the exact bytes, computed independently with Node's crypto.
    expect(metadata.body_sha256).toBe(
      '1b8b4c0b6f6ad1d32565952720bc004eeb1f188f62045e4d5525ae2af8c78432',
    );
  });

  it('should give every write a fresh canonical nonce', async () => {
    const first = await signedMetadata('PUT', '{}');
    const second = await signedMetadata('PUT', '{}');

    expect(first.nonce).toMatch(UUID);
    expect(second.nonce).not.toBe(first.nonce);
  });

  it('should add nothing to a read', async () => {
    expect(await signedMetadata('GET', undefined)).toEqual({});
  });
});
