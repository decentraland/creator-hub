import {
  BaseError,
  concat,
  ContractFunctionRevertedError,
  createPublicClient,
  encodeFunctionData,
  hexToString,
  http,
  keccak256,
  stringToHex,
  toBytes,
  zeroAddress,
  type Address,
  type Hex,
} from 'viem';
import { namehash } from 'viem/ens';
import { ChainId } from '@dcl/schemas/dist/dapps/chain-id';
import { config } from '/@/config';
import type { LandTransaction } from '/@/lib/landTransactions';
import { getSceneJumpInUrl } from '/@/modules/utils';
import { DCLRegistrar, ENS as ENSRegistry, ENSResolver } from './abis';
import { dclRegistrar, ens, ensResolver } from './contracts';
import type { ContractData, ENS } from './types';

const DCL_SUFFIX = '.dcl.eth';
const DCL_LABEL = /^[a-z0-9]{2,15}$/;
const REDIRECT_PROTOCODE = '0x3000f2';

type Parcel = { x: number; y: number };

export type NameUsage = { landId: string | null; world: boolean };

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

/** A NAME's contenthash that eth.limo answers with a 308 to the jump URL of the parcel (draft URI protocode). */
export function encodeLandRedirect(parcel: Parcel): Hex {
  return concat([REDIRECT_PROTOCODE, stringToHex(getSceneJumpInUrl(parcel))]);
}

/** The parcel a `encodeLandRedirect` contenthash jumps to; null for any other content. */
export function decodeLandRedirect(content: string): Parcel | null {
  if (!content.toLowerCase().startsWith(REDIRECT_PROTOCODE)) return null;
  try {
    const url = new URL(hexToString(`0x${content.slice(REDIRECT_PROTOCODE.length)}`));
    const [x, y] = (url.searchParams.get('position') ?? '').split(',').map(Number);
    return Number.isInteger(x) && Number.isInteger(y) ? { x, y } : null;
  } catch {
    return null;
  }
}

/** Sets a NAME's contenthash (`0x` clears it); a NAME with no resolver first gets the public one. */
export function buildLinkName(
  name: Pick<ENS, 'subdomain' | 'resolver'>,
  content: Hex,
): LandTransaction[] {
  const node = namehash(name.subdomain);
  const hasResolver = !!name.resolver && name.resolver.toLowerCase() !== zeroAddress;
  const resolver = hasResolver ? (name.resolver as Address) : contractAddress(ensResolver);
  const setContent = {
    to: resolver,
    data: encodeFunctionData({
      abi: ENSResolver,
      functionName: 'setContenthash',
      args: [node, content],
    }),
  };
  if (hasResolver) return [setContent];
  return [
    {
      to: contractAddress(ens),
      data: encodeFunctionData({
        abi: ENSRegistry,
        functionName: 'setResolver',
        args: [node, contractAddress(ensResolver)],
      }),
    },
    setContent,
  ];
}

/** Which LAND (by the parcel its contenthash jumps to) or published World already uses a NAME. */
export function getNameUsage(
  name: ENS,
  landIdByParcel: Record<string, string>,
  publishedWorlds: Set<string>,
): NameUsage {
  const parcel = decodeLandRedirect(name.content ?? '');
  return {
    landId: parcel ? (landIdByParcel[`${parcel.x},${parcel.y}`] ?? null) : null,
    world: publishedWorlds.has(name.subdomain),
  };
}
