import { describe, expect, it } from 'vitest';
import { Authenticator } from '@dcl/crypto';
import { createUnsafeIdentity } from '@dcl/crypto/dist/crypto';
import { signedHeaderFactory } from 'decentraland-crypto-fetch';

/**
 * Pins the ADR-44 payload format this app signs.
 *
 * `decentraland-crypto-fetch` 2.0.1 lowercased the whole joined string before signing while sending
 * `x-identity-metadata` verbatim, which left the metadata's casing outside the signature. Services
 * on `@dcl/crypto-middleware` 6 sign the metadata bytes as delivered, so anything this app sends
 * with uppercase in it -- a world access password, an uppercase community id -- stopped verifying.
 *
 * Asserted against the installed package rather than a restated copy of the format, so downgrading
 * the dependency fails here instead of in production.
 */
describe('when signing a request with metadata', () => {
  /** The payload the signature covers is the last auth-chain link's `payload`. */
  async function signedPayloadFor(
    method: string,
    path: string,
    metadata: Record<string, unknown>,
  ): Promise<string> {
    const ephemeralIdentity = createUnsafeIdentity();
    const realAccount = createUnsafeIdentity();
    const identity = await Authenticator.initializeAuthChain(
      realAccount.address,
      ephemeralIdentity,
      10,
      async message => Authenticator.createSignature(realAccount, message),
    );

    const headers = signedHeaderFactory()(identity, method, path, metadata);
    const links: { payload: string }[] = [];
    headers.forEach((value, name) => {
      if (name.startsWith('x-identity-auth-chain-')) {
        links.push(JSON.parse(value));
      }
    });

    return links[links.length - 1].payload;
  }

  it('should leave the metadata bytes exactly as they will be delivered', async () => {
    // The world access password: the flow that broke. The dialog never normalizes its case.
    const metadata = { type: 'shared-secret', secret: 'MyPassWord123' };

    const payload = await signedPayloadFor(
      'POST',
      '/world/foo.dcl.eth/permissions/access',
      metadata,
    );

    expect(payload.endsWith(JSON.stringify(metadata))).toBe(true);
  });

  it('should lowercase the method and the path', async () => {
    const payload = await signedPayloadFor('POST', '/World/Foo/Permissions', {});

    expect(payload.startsWith('post:/world/foo/permissions:')).toBe(true);
  });

  it('should distinguish metadata differing only in case', async () => {
    // Under the previous fold these collapsed to one string, which is what let a re-cased field ride
    // an otherwise valid signature.
    const path = '/world/foo.dcl.eth/permissions/access';

    const lower = await signedPayloadFor('POST', path, {
      type: 'shared-secret',
      secret: 'mypassword123',
    });
    const mixed = await signedPayloadFor('POST', path, {
      type: 'shared-secret',
      secret: 'MyPassWord123',
    });

    const metadataOf = (payload: string) => payload.split(':').slice(3).join(':');

    expect(metadataOf(lower)).not.toEqual(metadataOf(mixed));
  });
});
