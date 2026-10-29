import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  encodeFunctionData,
  http,
  keccak256,
  toBytes,
  type Address,
  type Hex,
} from 'viem';
import { namehash } from 'viem/ens';
import { ChainId } from '@dcl/schemas/dist/dapps/chain-id';
import { config } from '/@/config';
import type { LandTransaction } from '/@/lib/landTransactions';
import { DCLRegistrar, ENSResolver } from './abis';
import { dclRegistrar, ensResolver } from './contracts';
import type { ContractData, ENS } from './types';

const DCL_SUFFIX = '.dcl.eth';
const DCL_LABEL = /^[a-z0-9]{2,15}$/;

type NameUsage = { landId: string | null; world: boolean };

const chainId = (): ChainId => Number(config.get('CHAIN_ID')) || ChainId.ETHEREUM_MAINNET;

function contractAddress(contracts: Partial<Record<ChainId, ContractData>>): Address {
  const contract = contracts[chainId()];
  if (!contract) throw new Error(`No contract for chain ${chainId()}`);
  return contract.address as Address;
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
    to: contractAddress(ensResolver),
    data: encodeFunctionData({
      abi: ENSResolver,
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
