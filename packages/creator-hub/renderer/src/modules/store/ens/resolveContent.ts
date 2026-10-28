import {
  BaseError,
  ContractFunctionRevertedError,
  decodeFunctionResult,
  decodeErrorResult,
  encodeFunctionData,
  parseAbi,
  toHex,
  type Address,
  type PublicClient,
} from 'viem';
import { namehash, normalize, packetToBytes } from 'viem/ens';

const universalResolverAbi = parseAbi([
  'function resolveWithGateways(bytes name, bytes data, string[] gateways) view returns (bytes result, address resolver)',
  'error ResolverNotFound(bytes name)',
  'error ResolverNotContract(bytes name, address resolver)',
  'error UnsupportedResolverProfile(bytes4 selector)',
  'error ResolverError(bytes errorData)',
  'error HttpError(uint16 status, string message)',
]);
const unreachableNameAbi = parseAbi(['error UnreachableName(bytes name)']);
const contenthashAbi = parseAbi(['function contenthash(bytes32 node) view returns (bytes)']);

/** Read the raw contenthash, including wildcard and CCIP-Read resolver records. */
export async function resolveContent(
  client: Pick<PublicClient, 'readContract'>,
  name: string,
  universalResolverAddress: Address,
): Promise<{ content: string; resolver?: string }> {
  const normalizedName = normalize(name);
  try {
    const [result, resolver] = await client.readContract({
      address: universalResolverAddress,
      abi: universalResolverAbi,
      functionName: 'resolveWithGateways',
      args: [
        toHex(packetToBytes(normalizedName)),
        encodeFunctionData({
          abi: contenthashAbi,
          functionName: 'contenthash',
          args: [namehash(normalizedName)],
        }),
        // ENSIP-21 public protocol marker, supported by viem 2.46.2. Avoid a private viem import.
        // https://docs.ens.domains/ensip/21/
        ['x-batch-gateway:true'],
      ],
    });

    const content =
      result === '0x'
        ? ''
        : decodeFunctionResult({
            abi: contenthashAbi,
            functionName: 'contenthash',
            data: result,
          });

    return {
      content: content === '0x' ? '' : content,
      resolver: resolver.toLowerCase(),
    };
  } catch (error) {
    const reverted =
      error instanceof BaseError
        ? error.walk(cause => cause instanceof ContractFunctionRevertedError)
        : undefined;
    if (
      reverted instanceof ContractFunctionRevertedError &&
      ['ResolverNotFound', 'ResolverNotContract', 'UnsupportedResolverProfile'].includes(
        reverted.data?.errorName ?? '',
      )
    ) {
      // No effective resolver was returned. The caller retains its direct registry fallback.
      return { content: '' };
    }
    if (
      reverted instanceof ContractFunctionRevertedError &&
      reverted.data?.errorName === 'ResolverError'
    ) {
      try {
        // An ancestor resolver can explicitly report that an unconfigured child is unreachable.
        // Decode the full error: unrelated resolver failures and malformed payloads stay visible.
        const inner = reverted.data.args?.[0];
        if (
          typeof inner === 'string' &&
          decodeErrorResult({ abi: unreachableNameAbi, data: inner as `0x${string}` }).errorName ===
            'UnreachableName'
        ) {
          return { content: '' };
        }
      } catch {
        // Preserve the original resolver error if its inner payload is not UnreachableName.
      }
    }
    throw error;
  }
}
