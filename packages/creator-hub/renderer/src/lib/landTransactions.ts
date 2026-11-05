import {
  createPublicClient,
  encodeFunctionData,
  http,
  isAddressEqual,
  isHash,
  parseAbi,
  toHex,
  zeroAddress,
  type Address,
  type Hex,
} from 'viem';
import { config } from '/@/config';
import { AuthServerProvider } from './auth';
import { LandType, RoleType, type Land } from './land';

const landRegistryAbi = parseAbi([
  'function transferFrom(address from, address to, uint256 assetId)',
  'function setManyUpdateOperator(uint256[] assetIds, address operator)',
  'function setUpdateManager(address owner, address operator, bool approved)',
  'function updateLandData(int256 x, int256 y, string data)',
]);

const estateRegistryAbi = parseAbi([
  'function transferFrom(address from, address to, uint256 tokenId)',
  'function setManyUpdateOperator(uint256[] estateIds, address operator)',
  'function setManyLandUpdateOperator(uint256 estateId, uint256[] landIds, address operator)',
  'function setUpdateManager(address owner, address operator, bool approved)',
  'function updateMetadata(uint256 estateId, string metadata)',
]);

const rentalsAbi = parseAbi([
  'function setUpdateOperator(address[] contractAddresses, uint256[] tokenIds, address[] operators)',
]);

const DEFAULT_RECEIPT_TIMEOUT_MS = 3 * 60_000;

export type LandTransaction = { to: Address; data: Hex };

type LandTransactionStatus = 'confirmed' | 'failed' | 'unconfirmed';

type LandTransactionResult = { hash: Hex; status: LandTransactionStatus };

const landRegistry = () => config.get('LAND_REGISTRY_ADDRESS') as Address;
const estateRegistry = () => config.get('ESTATE_REGISTRY_ADDRESS') as Address;
const registryOf = (land: Land) =>
  land.type === LandType.ESTATE ? estateRegistry() : landRegistry();

/** Port of `LANDRegistry.encodeTokenId(x, y)`. */
export function encodeTokenId(x: number, y: number): bigint {
  return (BigInt.asUintN(128, BigInt(x)) << 128n) | BigInt.asUintN(128, BigInt(y));
}

/** On-chain LAND metadata, byte-for-byte as Builder's `buildMetadata` writes it. */
export function buildLandMetadata(name: string, description = ''): string {
  return `0,"${name.replace(/"/g, '\\"')}","${description.replace(/"/g, '\\"')}",`;
}

/** `transferFrom` on the registry that holds the parcel or estate. */
export function buildTransferLand(land: Land, from: Address, to: Address): LandTransaction {
  return {
    to: registryOf(land),
    data: encodeFunctionData({
      abi: landRegistryAbi,
      functionName: 'transferFrom',
      args: [from, to, BigInt(land.tokenId)],
    }),
  };
}

/** Name and description: `updateLandData` for a parcel, `updateMetadata` for an estate. */
export function buildUpdateLandMetadata(
  land: Land,
  name: string,
  description: string,
): LandTransaction {
  const metadata = buildLandMetadata(name, description);
  if (land.type === LandType.ESTATE) {
    return {
      to: estateRegistry(),
      data: encodeFunctionData({
        abi: estateRegistryAbi,
        functionName: 'updateMetadata',
        args: [BigInt(land.tokenId), metadata],
      }),
    };
  }
  return {
    to: landRegistry(),
    data: encodeFunctionData({
      abi: landRegistryAbi,
      functionName: 'updateLandData',
      args: [BigInt(land.x!), BigInt(land.y!), metadata],
    }),
  };
}

/** Whole-token update operator; `null` revokes, tenants go through Rentals. */
export function buildSetLandOperator(land: Land, operator: Address | null): LandTransaction {
  const target = operator ?? zeroAddress;
  const tokenId = BigInt(land.tokenId);

  if (land.roles.includes(RoleType.TENANT)) {
    return {
      to: config.get('RENTALS_ADDRESS') as Address,
      data: encodeFunctionData({
        abi: rentalsAbi,
        functionName: 'setUpdateOperator',
        args: [[registryOf(land)], [tokenId], [target]],
      }),
    };
  }
  return {
    to: registryOf(land),
    data: encodeFunctionData({
      abi: landRegistryAbi,
      functionName: 'setManyUpdateOperator',
      args: [[tokenId], target],
    }),
  };
}

/** Sets (or revokes, with `null`) the update operator of some parcels inside an estate. */
export function buildSetEstateParcelsOperator(
  estateId: string,
  parcels: { x: number; y: number }[],
  operator: Address | null,
): LandTransaction {
  return {
    to: estateRegistry(),
    data: encodeFunctionData({
      abi: estateRegistryAbi,
      functionName: 'setManyLandUpdateOperator',
      args: [
        BigInt(estateId),
        parcels.map(({ x, y }) => encodeTokenId(x, y)),
        operator ?? zeroAddress,
      ],
    }),
  };
}

/** Account-wide manager: one `setUpdateManager` per registry, LAND first. */
export function buildSetUpdateManager(
  owner: Address,
  manager: Address,
  approved: boolean,
): [LandTransaction, LandTransaction] {
  const data = encodeFunctionData({
    abi: landRegistryAbi,
    functionName: 'setUpdateManager',
    args: [owner, manager, approved],
  });
  return [
    { to: landRegistry(), data },
    { to: estateRegistry(), data },
  ];
}

/** @throws RelayError when rejected, expired, or there is no identity. */
export async function sendLandTransaction(
  tx: LandTransaction,
  {
    receiptTimeoutMs = DEFAULT_RECEIPT_TIMEOUT_MS,
    onSent,
  }: { receiptTimeoutMs?: number; onSent?: (hash: Hex) => void } = {},
): Promise<LandTransactionResult> {
  const provider = new AuthServerProvider();
  await provider.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: toHex(Number(config.get('CHAIN_ID'))) }],
  });

  const hash: unknown = await provider.request({
    method: 'eth_sendTransaction',
    params: [{ to: tx.to, data: tx.data }],
  });
  if (typeof hash !== 'string' || !isHash(hash)) {
    throw new Error(`Unexpected transaction hash: ${String(hash)}`);
  }
  onSent?.(hash);

  const client = createPublicClient({ transport: http(config.get('RPC_URL')) });
  try {
    const receipt = await client.waitForTransactionReceipt({ hash, timeout: receiptTimeoutMs });
    const confirmed =
      receipt.status === 'success' && !!receipt.to && isAddressEqual(receipt.to, tx.to);
    return { hash, status: confirmed ? 'confirmed' : 'failed' };
  } catch {
    return { hash, status: 'unconfirmed' };
  }
}
