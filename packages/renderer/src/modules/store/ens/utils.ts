import { ChainId } from '@dcl/schemas/dist/dapps/chain-id';
import { ENSProvider } from './types';

export function extractEntityId(urn: string): string | undefined {
  const entitySuffixMatcher = new RegExp(
    '((?<=entity:)(?<entityId>[^\\?|\\s]+)(\\?=\\&baseUrl=(?<baseUrl>[^\\?|\\s]+))?)',
  );

  const matches = entitySuffixMatcher.exec(urn);

  return (matches && matches.groups && matches.groups.entityId) || undefined;
}

export function isValidENSName(name: string): boolean {
  return /^[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)?\.eth$/.test(name);
}

export function isDev(chainId: ChainId): boolean {
  return chainId === ChainId.ETHEREUM_SEPOLIA;
}

export function getEnsProvider(subdomain: string): ENSProvider {
  if (subdomain.endsWith('.dcl.eth')) {
    return ENSProvider.DCL;
  }

  return ENSProvider.ENS;
}
