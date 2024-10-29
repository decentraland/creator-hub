import { ChainId } from '@dcl/schemas/dist/dapps/chain-id';

export function isDev(chainId: ChainId): boolean {
  return chainId === ChainId.ETHEREUM_SEPOLIA;
}
