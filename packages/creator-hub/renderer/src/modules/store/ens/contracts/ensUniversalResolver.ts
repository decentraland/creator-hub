import { mainnet, sepolia } from 'viem/chains';
import type { Address } from 'viem';
import { ChainId } from '@dcl/schemas/dist/dapps/chain-id';

/**
 * ENS Universal Resolver per chain, taken from viem's chain definitions.
 * It finds a name's current resolver and follows wildcard and offchain (CCIP-Read) lookups,
 * so records are never read from a hardcoded resolver that the name may no longer use.
 */
export const ensUniversalResolver: Partial<Record<ChainId, Address>> = {
  [ChainId.ETHEREUM_MAINNET]: mainnet.contracts.ensUniversalResolver.address,
  [ChainId.ETHEREUM_SEPOLIA]: sepolia.contracts.ensUniversalResolver.address,
};
