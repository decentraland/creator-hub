import { ChainId } from '@dcl/schemas/dist/dapps/chain-id';
import { config } from '/@/config';

export function isDev(chainId: ChainId): boolean {
  return chainId === ChainId.ETHEREUM_SEPOLIA;
}

export const REPORT_ISSUES_URL = config.get('REPORT_ISSUES_URL');
export const FEEDBACK_URL = config.get('FEEDBACK_URL');
