import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BaseError,
  ContractFunctionRevertedError,
  encodeErrorResult,
  parseAbi,
  encodeAbiParameters,
  type Address,
  type PublicClient,
} from 'viem';
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

  it('should request contenthash for the same normalized name as the DNS lookup', async () => {
    await resolveContent(client, 'NaMe.DCL.eth', universalResolverAddress);

    expect(readContract).toHaveBeenCalledWith({
      address: universalResolverAddress,
      abi: expect.any(Array),
      functionName: 'resolveWithGateways',
      args: [
        '0x046e616d650364636c0365746800',
        '0xbc1c58d10b186ec5f7dc9a37a16b2b106ace014ec3bc95448b26f292be904c08b57e8374',
        ['x-batch-gateway:true'],
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

  describe('and the raw result is empty', () => {
    beforeEach(() => {
      readContract.mockResolvedValueOnce(['0x', resolver]);
    });

    it('should retain the effective resolver with empty content', async () => {
      await expect(
        resolveContent(client, 'name.dcl.eth', universalResolverAddress),
      ).resolves.toEqual({
        content: '',
        resolver: resolver.toLowerCase(),
      });
    });
  });

  describe.each([
    ['ResolverNotFound', 'error ResolverNotFound(bytes name)', ['0x']],
    [
      'ResolverNotContract',
      'error ResolverNotContract(bytes name, address resolver)',
      ['0x', '0x1111111111111111111111111111111111111111'],
    ],
    [
      'UnsupportedResolverProfile',
      'error UnsupportedResolverProfile(bytes4 selector)',
      ['0xbc1c58d1'],
    ],
  ])('and the contract returns %s', (errorName, signature, args) => {
    beforeEach(() => {
      const abi = parseAbi([signature]);
      readContract.mockRejectedValueOnce(
        new BaseError('Contract call failed', {
          cause: new ContractFunctionRevertedError({
            abi,
            data: encodeErrorResult({ abi, errorName, args }),
            functionName: 'resolveWithGateways',
          }),
        }),
      );
    });

    it('should return no content without claiming an effective resolver', async () => {
      await expect(
        resolveContent(client, 'name.dcl.eth', universalResolverAddress),
      ).resolves.toEqual({ content: '' });
    });
  });

  describe('and an ancestor resolver reports an unreachable child', () => {
    beforeEach(() => {
      const abi = parseAbi(['error ResolverError(bytes errorData)']);
      readContract.mockRejectedValueOnce(
        new BaseError('Contract call failed', {
          cause: new ContractFunctionRevertedError({
            abi,
            data: encodeErrorResult({
              abi,
              errorName: 'ResolverError',
              args: [
                encodeErrorResult({
                  abi: parseAbi(['error UnreachableName(bytes name)']),
                  errorName: 'UnreachableName',
                  args: ['0x0c67656e65736973706c617a610364636c0365746800'],
                }),
              ],
            }),
            functionName: 'resolveWithGateways',
          }),
        }),
      );
    });

    it('should return no content and retain the caller registry fallback', async () => {
      await expect(
        resolveContent(client, 'genesisplaza.dcl.eth', universalResolverAddress),
      ).resolves.toEqual({ content: '' });
    });
  });

  describe.each([
    ['HttpError', 'error HttpError(uint16 status, string message)', [503, 'Unavailable']],
    ['ResolverError', 'error ResolverError(bytes errorData)', ['0x1234']],
    ['ResolverError', 'error ResolverError(bytes errorData)', ['0x5fe9a5df']],
  ])('and the contract reports an operational %s', (errorName, signature, args) => {
    let error: BaseError;

    beforeEach(() => {
      const abi = parseAbi([signature]);
      error = new BaseError('Contract call failed', {
        cause: new ContractFunctionRevertedError({
          abi,
          data: encodeErrorResult({ abi, errorName, args }),
          functionName: 'resolveWithGateways',
        }),
      });
      readContract.mockRejectedValueOnce(error);
    });

    it('should preserve the failure', async () => {
      await expect(resolveContent(client, 'name.dcl.eth', universalResolverAddress)).rejects.toBe(
        error,
      );
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
