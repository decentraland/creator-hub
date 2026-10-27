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

  return {
    content: decodeFunctionResult({
      abi: contenthashAbi,
      functionName: 'contenthash',
      data: result,
    }),
    resolver: resolver.toLowerCase(),
  };
}
