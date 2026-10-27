import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPublicClient,
  custom,
  decodeAbiParameters,
  encodeAbiParameters,
  encodeErrorResult,
  encodeFunctionData,
  parseAbi,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';
import { resolveContent } from './resolveContent';

describe('when viem handles a local CCIP batch for ENS content', () => {
  let request: ReturnType<typeof vi.fn>;
  let gatewayRequest: ReturnType<typeof vi.fn>;
  let client: Pick<PublicClient, 'readContract'>;
  let universalResolverAddress: Address;
  let resolver: Address;
  let callbackData: Hex;

  beforeEach(() => {
    universalResolverAddress = '0xeeeeeeee14d718c2b47d9923deab1335e144eeee';
    resolver = '0x1111111111111111111111111111111111111111';
    const batchAbi = parseAbi([
      'function query((address sender, string[] urls, bytes data)[] requests) view returns (bool[] failures, bytes[] responses)',
    ]);
    const offchainAbi = parseAbi([
      'error OffchainLookup(address sender, string[] urls, bytes callData, bytes4 callbackFunction, bytes extraData)',
    ]);
    const batchData = encodeFunctionData({
      abi: batchAbi,
      functionName: 'query',
      args: [[{ sender: resolver, urls: ['https://resolver.example/lookup'], data: '0x1234' }]],
    });
    request = vi.fn().mockRejectedValueOnce({
      code: 3,
      message: 'execution reverted',
      data: encodeErrorResult({
        abi: offchainAbi,
        errorName: 'OffchainLookup',
        args: [
          universalResolverAddress,
          ['x-batch-gateway:true'],
          batchData,
          '0x12345678',
          '0x9876',
        ],
      }),
    });
    request.mockImplementationOnce(async ({ params }) => {
      callbackData = params[0].data;
      return encodeAbiParameters(
        [{ type: 'bytes' }, { type: 'address' }],
        [encodeAbiParameters([{ type: 'bytes' }], ['0xe301017012201234']), resolver],
      );
    });
    gatewayRequest = vi.fn().mockResolvedValueOnce('0xabcd');
    client = createPublicClient({
      transport: custom({ request }, { retryCount: 0 }),
      ccipRead: { request: gatewayRequest },
    });
  });

  it('should query the inner gateway directly and submit its batched result to the onchain callback', async () => {
    await expect(resolveContent(client, 'name.dcl.eth', universalResolverAddress)).resolves.toEqual(
      { content: '0xe301017012201234', resolver },
    );
    expect(gatewayRequest).toHaveBeenCalledTimes(1);
    expect(gatewayRequest).toHaveBeenCalledWith({
      sender: resolver,
      urls: ['https://resolver.example/lookup'],
      data: '0x1234',
    });
    expect(callbackData.slice(0, 10)).toBe('0x12345678');
    expect(
      decodeAbiParameters([{ type: 'bytes' }, { type: 'bytes' }], `0x${callbackData.slice(10)}`),
    ).toEqual([
      encodeAbiParameters([{ type: 'bool[]' }, { type: 'bytes[]' }], [[false], ['0xabcd']]),
      '0x9876',
    ]);
  });
});
