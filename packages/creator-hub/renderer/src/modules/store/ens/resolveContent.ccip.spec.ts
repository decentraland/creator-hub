import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPublicClient,
  custom,
  decodeFunctionData,
  encodeAbiParameters,
  encodeErrorResult,
  encodeFunctionData,
  parseAbi,
  type Address,
  type PublicClient,
} from 'viem';
import { resolveContent } from './resolveContent';

describe('when viem handles a local CCIP batch for ENS content', () => {
  let request: ReturnType<typeof vi.fn>;
  let gatewayRequest: ReturnType<typeof vi.fn>;
  let client: Pick<PublicClient, 'readContract'>;
  let universalResolverAddress: Address;
  let resolver: Address;

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
    request = vi.fn().mockImplementationOnce(async ({ params }) => {
      expect(
        decodeFunctionData({
          abi: parseAbi([
            'function resolveWithGateways(bytes name, bytes data, string[] gateways) view returns (bytes result, address resolver)',
          ]),
          data: params[0].data,
        }),
      ).toEqual({
        functionName: 'resolveWithGateways',
        args: [
          '0x046e616d650364636c0365746800',
          '0xbc1c58d10b186ec5f7dc9a37a16b2b106ace014ec3bc95448b26f292be904c08b57e8374',
          ['x-batch-gateway:true'],
        ],
      });
      throw {
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
      };
    });
    request.mockResolvedValueOnce(
      encodeAbiParameters(
        [{ type: 'bytes' }, { type: 'address' }],
        [encodeAbiParameters([{ type: 'bytes' }], ['0xe301017012201234']), resolver],
      ),
    );
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
  });
});
