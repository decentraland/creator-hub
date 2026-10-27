import {
  decodeFunctionResult,
  encodeFunctionData,
  parseAbi,
  toHex,
  type Address,
  type PublicClient,
} from 'viem';
import { namehash, normalize, packetToBytes } from 'viem/ens';

const universalResolverAbi = parseAbi([
  'function resolve(bytes name, bytes data) view returns (bytes result, address resolver)',
  'error ResolverNotFound(bytes name)',
  'error ResolverNotContract(bytes name, address resolver)',
  'error UnsupportedResolverProfile(bytes4 selector)',
  'error ResolverError(bytes errorData)',
  'error HttpError(uint16 status, string message)',
]);
const contenthashAbi = parseAbi(['function contenthash(bytes32 node) view returns (bytes)']);

/** Read the raw contenthash, including wildcard and CCIP-Read resolver records. */
export async function resolveContent(
  client: Pick<PublicClient, 'readContract'>,
  name: string,
  universalResolverAddress: Address,
) {
  const normalizedName = normalize(name);
  const [result, resolver] = await client.readContract({
    address: universalResolverAddress,
    abi: universalResolverAbi,
    functionName: 'resolve',
    args: [
      toHex(packetToBytes(normalizedName)),
      encodeFunctionData({
        abi: contenthashAbi,
        functionName: 'contenthash',
        args: [namehash(normalizedName)],
      }),
    ],
  });

  const content = decodeFunctionResult({
    abi: contenthashAbi,
    functionName: 'contenthash',
    data: result,
  });

  return {
    content: content === '0x' ? '' : content,
    resolver: resolver.toLowerCase(),
  };
}
