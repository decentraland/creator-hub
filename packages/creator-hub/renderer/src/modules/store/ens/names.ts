import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  encodeFunctionData,
  http,
  keccak256,
  parseAbi,
  toBytes,
  type Address,
  type Hex,
} from 'viem';
import { namehash } from 'viem/ens';
import { ChainId } from '@dcl/schemas/dist/dapps/chain-id';
import { config } from '/@/config';
import type { LandTransaction } from '/@/lib/landTransactions';
import { DCLRegistrar } from './abis';
import { dclRegistrar } from './contracts';
import type { ContractData, ENS } from './types';

const DCL_SUFFIX = '.dcl.eth';
const DCL_LABEL = /^[a-z0-9]{2,15}$/;

type NameUsage = { landId: string | null; world: boolean };

/**
 * The ENS public resolver a NAME is written through. Kept here rather than in `./abis` and
 * `./contracts` because reads go through the Universal Resolver (#1724), which drops those modules;
 * writes still need the public resolver itself.
 */
export const PUBLIC_RESOLVER_ABI = parseAbi(['function setContenthash(bytes32 node, bytes hash)']);

export const PUBLIC_RESOLVER: Partial<Record<ChainId, Address>> = {
  [ChainId.ETHEREUM_MAINNET]: '0x4976fb03c32e5b8cfe2b6ccb31c09ba78ebaba41',
  [ChainId.ETHEREUM_SEPOLIA]: '0x8FADE66B79cC9f707aB26799354482EB93a5B7dD',
};

const chainId = (): ChainId => Number(config.get('CHAIN_ID')) || ChainId.ETHEREUM_MAINNET;

function contractAddress(contracts: Partial<Record<ChainId, ContractData>>): Address {
  const contract = contracts[chainId()];
  if (!contract) throw new Error(`No contract for chain ${chainId()}`);
  return contract.address as Address;
}

function publicResolverAddress(): Address {
  const address = PUBLIC_RESOLVER[chainId()];
  if (!address) throw new Error(`No contract for chain ${chainId()}`);
  return address;
}

/** `foo` or `foo.dcl.eth` → `foo`; null when it cannot be a Decentraland NAME. */
export function toDCLNameLabel(name: string): string | null {
  const lower = name.trim().toLowerCase();
  const label = lower.endsWith(DCL_SUFFIX) ? lower.slice(0, -DCL_SUFFIX.length) : lower;
  return DCL_LABEL.test(label) ? label : null;
}

/** Wallet that holds a Decentraland NAME, lowercased; null when the NAME does not exist. */
export async function resolveNameOwner(name: string): Promise<Address | null> {
  const label = toDCLNameLabel(name);
  if (!label) return null;

  const client = createPublicClient({ transport: http(config.get('RPC_URL')) });
  try {
    const owner = await client.readContract({
      address: contractAddress(dclRegistrar),
      abi: DCLRegistrar,
      functionName: 'ownerOf',
      args: [BigInt(keccak256(toBytes(label)))],
    });
    return owner.toLowerCase() as Address;
  } catch (error) {
    const reverted =
      error instanceof BaseError &&
      error.walk(cause => cause instanceof ContractFunctionRevertedError);
    if (reverted) return null;
    throw error;
  }
}

/** Points a NAME at the content hash from `LandRedirections.create`. */
export function buildSetNameContent(subdomain: string, contentHash: Hex): LandTransaction {
  return {
    to: publicResolverAddress(),
    data: encodeFunctionData({
      abi: PUBLIC_RESOLVER_ABI,
      functionName: 'setContenthash',
      args: [namehash(subdomain), contentHash],
    }),
  };
}

/** Which LAND (from `LandRedirections.fetchHashes`) or published World already uses a NAME. */
export function getNameUsage(
  name: ENS,
  landIdByHash: Record<string, string>,
  publishedWorlds: Set<string>,
): NameUsage {
  return {
    landId: landIdByHash[name.content.toLowerCase()] ?? null,
    world: publishedWorlds.has(name.subdomain),
  };
}
