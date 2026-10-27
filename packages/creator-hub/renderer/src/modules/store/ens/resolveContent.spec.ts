import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeAbiParameters, type Address, type PublicClient } from 'viem';
import { resolveContent } from './resolveContent';

describe('when resolving ENS content', () => {
  let readContract: ReturnType<typeof vi.fn>;
  let client: Pick<PublicClient, 'readContract'>;
  let universalResolverAddress: Address;
  let resolver: Address;

  beforeEach(() => {
    universalResolverAddress = '0xeeeeeeee14d718c2b47d9923deab1335e144eeee';
    resolver = '0xABaBaBaBABabABabAbAbABAbABabababaBaBABaB';
    readContract = vi
      .fn()
      .mockResolvedValue([
        encodeAbiParameters([{ type: 'bytes' }], ['0xe301017012201234']),
        resolver,
      ]);
    client = { readContract };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should request contenthash for the same normalized name as the DNS lookup', async () => {
    await resolveContent(client, 'NaMe.DCL.eth', universalResolverAddress);

    expect(readContract).toHaveBeenCalledWith({
      address: universalResolverAddress,
      abi: expect.any(Array),
      functionName: 'resolve',
      args: [
        '0x046e616d650364636c0365746800',
        '0xbc1c58d10b186ec5f7dc9a37a16b2b106ace014ec3bc95448b26f292be904c08b57e8374',
      ],
    });
  });

  it('should preserve the raw contenthash and lowercase the effective resolver', async () => {
    await expect(resolveContent(client, 'name.dcl.eth', universalResolverAddress)).resolves.toEqual(
      {
        content: '0xe301017012201234',
        resolver: resolver.toLowerCase(),
      },
    );
  });

  describe('and the record is empty', () => {
    beforeEach(() => {
      readContract.mockResolvedValueOnce([
        encodeAbiParameters([{ type: 'bytes' }], ['0x']),
        resolver,
      ]);
    });

    it('should return an empty string', async () => {
      await expect(
        resolveContent(client, 'name.dcl.eth', universalResolverAddress),
      ).resolves.toEqual({
        content: '',
        resolver: resolver.toLowerCase(),
      });
    });
  });

  describe('and the lookup fails', () => {
    let error: Error;

    beforeEach(() => {
      error = new Error('Gateway unavailable');
      readContract.mockRejectedValueOnce(error);
    });

    it('should preserve the error for the caller to report', async () => {
      await expect(resolveContent(client, 'name.dcl.eth', universalResolverAddress)).rejects.toBe(
        error,
      );
    });
  });

  describe('and the resolver response is malformed', () => {
    beforeEach(() => {
      readContract.mockResolvedValueOnce(['0x1234', resolver]);
    });

    it('should reject instead of reporting an empty record', async () => {
      await expect(
        resolveContent(client, 'name.dcl.eth', universalResolverAddress),
      ).rejects.toThrow();
    });
  });
});
